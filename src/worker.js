import {
  AutoTokenizer,
  AutoModelForCausalLM,
  TextStreamer,
  InterruptableStoppingCriteria,
} from "@huggingface/transformers";

/**
 * This class uses the Singleton pattern to enable lazy-loading of the pipeline
 */
class TextGenerationPipeline {
  static model_id = "onnx-community/Llama-3.2-1B-Instruct-q4f16";
  static deepseek_model_id = "onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX";
  static phi_model_id = "onnx-community/Phi-3.5-mini-instruct-onnx-web";
  static current_model_id = TextGenerationPipeline.model_id;

  static async getInstance(progress_callback = null, model_type = "llama") {
    // Set current model based on type
    if (model_type === "phi") {
      this.current_model_id = this.phi_model_id;
    } else if (model_type === "deepseek") {
      this.current_model_id = this.deepseek_model_id;
    } else {
      this.current_model_id = this.model_id;
    }
    try {
      this.tokenizer ??= AutoTokenizer.from_pretrained(this.current_model_id, {
        progress_callback,
      });

      // Try to get adapter before model loading
      let adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance"
      });
      
      if (!adapter) {
        console.log("High-performance adapter not available, falling back to low-power");
        adapter = await navigator.gpu.requestAdapter({
          powerPreference: "low-power"
        });
      }

      if (!adapter) {
        throw new Error("No WebGPU adapter available");
      }

      console.log("Loading model using GPU adapter with preference:", adapter ? "high-performance" : "low-power");

      this.model ??= AutoModelForCausalLM.from_pretrained(this.current_model_id, {
        dtype: "q4f16",
        device: "webgpu",
        use_external_data_format: model_type === "phi",
        progress_callback,
      });

      return Promise.all([this.tokenizer, this.model]);
    } catch (e) {
      console.error("Error initializing model:", e);
      throw e;
    }
  }
}

const stopping_criteria = new InterruptableStoppingCriteria();

async function generate(messages, model_type) {
  // Retrieve the text-generation pipeline.
  const [tokenizer, model] = await TextGenerationPipeline.getInstance(null, model_type);

  const inputs = tokenizer.apply_chat_template(messages, {
    add_generation_prompt: true,
    return_dict: true,
  });

  let startTime;
  let numTokens = 0;
  let tps;
  const token_callback_function = () => {
    startTime ??= performance.now();

    if (numTokens++ > 0) {
      tps = (numTokens / (performance.now() - startTime)) * 1000;
    }
  };
  const callback_function = (output) => {
    self.postMessage({
      status: "update",
      output,
      tps,
      numTokens,
    });
  };

  const streamer = new TextStreamer(tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function,
    token_callback_function,
  });

  // Tell the main thread we are starting
  self.postMessage({ status: "start" });

  const { sequences } = await model.generate({
    ...inputs,
    // TODO: Add when model is fixed
    // past_key_values: past_key_values_cache,

    // Sampling
    do_sample: model_type === "phi",
    top_k: model_type === "phi" ? 3 : undefined,
    temperature: model_type === "phi" ? 0.2 : undefined,

    max_new_tokens: 1024,
    streamer,
    stopping_criteria,
    return_dict_in_generate: true,
  });

  const decoded = tokenizer.batch_decode(sequences, {
    skip_special_tokens: true,
  });

  // Send the output back to the main thread
  self.postMessage({
    status: "complete",
    output: decoded,
  });
}

async function check() {
  try {
    // First try to get a high-performance adapter (typically external GPU)
    let adapter = await navigator.gpu.requestAdapter({
      powerPreference: "high-performance"
    });

    // If that fails, try integrated GPU
    if (!adapter) {
      adapter = await navigator.gpu.requestAdapter({
        powerPreference: "low-power"
      });
    }

    if (!adapter) {
      throw new Error("WebGPU is not supported (no adapter found)");
    }

    // Log adapter type
    console.log("Using GPU adapter with preference:", adapter ? "high-performance" : "low-power");

  } catch (e) {
    console.error("GPU adapter error:", e);
    self.postMessage({
      status: "error",
      data: e.toString(),
    });
  }
}

async function load(model_type = "llama") {
  self.postMessage({
    status: "loading",
    data: "Loading model...",
  });

  // Load the pipeline and save it for future use.
  const [tokenizer, model] = await TextGenerationPipeline.getInstance((x) => {
    // We also add a progress callback to the pipeline so that we can
    // track model loading.
    self.postMessage(x);
  }, model_type);

  self.postMessage({
    status: "loading",
    data: "Compiling shaders and warming up model...",
  });

  // Run model with dummy input to compile shaders
  const inputs = tokenizer("a");
  await model.generate({ ...inputs, max_new_tokens: 1 });
  self.postMessage({ status: "ready" });
}

// Listen for messages from the main thread
self.addEventListener("message", async (e) => {
  const { type, data, model_type } = e.data;

  switch (type) {
    case "check":
      check();
      break;

    case "load":
      load(model_type);
      break;

    case "generate":
      stopping_criteria.reset();
      generate(data, model_type);
      break;

    case "interrupt":
      stopping_criteria.interrupt();
      break;

    case "reset":
      stopping_criteria.reset();
      break;
  }
});
