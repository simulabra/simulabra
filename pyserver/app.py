from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
import torch

app = FastAPI()

# Load model and tokenizer
model_name = "google/gemma-2-2b-it"  # You can change this to any model you prefer
tokenizer = AutoTokenizer.from_pretrained(model_name)
bnb_config = BitsAndBytesConfig(
  load_in_8bit=True,
)
model = AutoModelForCausalLM.from_pretrained(
  model_name, # your model here
  device_map="auto",
  quantization_config=bnb_config,
  trust_remote_code=True,
)

class CompletionRequest(BaseModel):
    prompt: str
    max_length: int = 50

class TokenizationRequest(BaseModel):
    text: str

@app.post("/complete")
async def complete_text(request: CompletionRequest):
    input_ids = tokenizer.encode(request.prompt, return_tensors="pt")
    
    output = model.generate(
        input_ids,
        max_length=request.max_length,
        num_return_sequences=1,
        no_repeat_ngram_size=2,
        do_sample=True,
        min_p=0.1,
        temperature=0.7
    )
    
    completed_text = tokenizer.decode(output[0], skip_special_tokens=True)
    return {"completed_text": completed_text}

@app.post("/tokenize")
async def tokenize_text(request: TokenizationRequest):
    tokens = tokenizer.tokenize(request.text)
    token_ids = tokenizer.convert_tokens_to_ids(tokens)
    return {"tokens": tokens, "token_ids": token_ids}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3032)
