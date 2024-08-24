from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
import torch
import torch.nn.functional as F
from repeng import ControlVector, ControlModel, DatasetEntry
import json
import numpy as np

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
control_model = ControlModel(model, list(range(-5, -22, -1)))
vector = ControlVector.import_gguf('./control_vectors/allcaps.gguf')


class CompletionRequest(BaseModel):
    prompt: str
    n_predict: int = 16
    n_probs: int = 10
    min_p: float = 0.05
    temperature: float = 0.6
    stop: list[str] = []
    logit_bias: dict[int, float] = {}

class CompletionResponse(BaseModel):
    content: str
    tops: dict[str, float]
    tokens: list[str]

@app.post("/completion")
async def completion(request: CompletionRequest):
    input_ids = tokenizer.encode(request.prompt, return_tensors="pt").to('cuda')

    control_model.reset()
    control_model.set_control(vector, 10)
    output = control_model.generate(
        input_ids,
        max_new_tokens=request.n_predict,
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
    content = content[len(request.prompt):]
    tokens = [tokenizer.decode([t]) for t in tokenizer.encode(content)]
    return CompletionResponse(content=content, tops=tops, tokens=tokens)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3032)
