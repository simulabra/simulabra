from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
import torch
import torch.nn.functional as F

app = FastAPI()

model_name = "google/gemma-2-2b-it"
tokenizer = AutoTokenizer.from_pretrained(
    model_name,
)
bnb_config = BitsAndBytesConfig(
    load_in_8bit=True,
)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    device_map="auto",
    quantization_config=bnb_config,
    trust_remote_code=True,
)

class CompletionRequest(BaseModel):
    prompt: str
    n_predict: int = 16
    n_probs: int = 10
    min_p: float = 0.05
    temperature: float = 0.6
    stop: list[str] = []

class CompletionResponse(BaseModel):
    content: str
    tops: dict[str, float]
    tokens: list[str]


class TokenizationRequest(BaseModel):
    text: str

@app.post("/complete")
async def complete_text(request: CompletionRequest):
    input_ids = tokenizer.encode(request.prompt, return_tensors="pt").to('cuda')

    output = model.generate(
        input_ids,
        max_length=request.n_predict,
        do_sample=True,
        min_p=request.min_p,
        temperature=request.temperature,
        return_dict_in_generate=True,
        output_scores=True,
    )
    logprobs = F.softmax(torch.stack(output.scores), dim=-1)
    top_probs, top_indices = torch.topk(logprobs[0, -1, :], request.n_probs)
    tops = {}
    for i, t in enumerate(top_indices):
        if top_probs[i] > 0.0001:
            tops[tokenizer.decode([t])] = top_probs[i]
    content = tokenizer.decode(output.sequences[0], skip_special_tokens=True)
    tokens = [tokenizer.decode([t]) for t in tokenizer.encode(content)]
    return CompletionResponse(content=content, tops=tops, tokens=tokens)

@app.post("/tokenize")
async def tokenize_text(request: TokenizationRequest):
    tokens = tokenizer.tokenize(request.text)
    token_ids = tokenizer.convert_tokens_to_ids(tokens)
    return {"tokens": tokens, "token_ids": token_ids}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3032)
