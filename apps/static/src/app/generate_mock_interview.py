#!/usr/bin/env python3
"""
generate_mock_interview.py
--------------------------------

• Calls Perplexity Chat Completion API.
• Builds a 30-minute mock MBA interview (10 Qs) for the requested school.
• Returns a Mongo-ready JSON object with questions, tone, interviewer_type.

Environment variables
---------------------
PERPLEXITY_API_KEY   – your Perplexity secret
SCHOOL_NAME          – injected by the Next.js API route

pip install requests
"""

import os, json, re, requests
from typing import Dict, Any
from dotenv import load_dotenv
load_dotenv()   

# ----------------------------------------------------------------- config
API_KEY = os.getenv("PERPLEXITY_API_KEY")
if not API_KEY:
    raise RuntimeError("Set PERPLEXITY_API_KEY")

MODEL    = "sonar"   # or any model available in your account
ENDPOINT = "https://api.perplexity.ai/chat/completions"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type":  "application/json"
}

# ---------------------------------------------------------------- helpers
_CODEBLOCK_RE = re.compile(r'^```(?:json)?\s*|\s*```$', re.I | re.M)

def strip_fence(txt: str) -> str:
    """Remove ```json … ``` fences if the model wraps its answer."""
    return _CODEBLOCK_RE.sub('', txt).strip()

def build_prompt(school: str) -> str:
    return f"""
You are an MBA interview coach.

Create a **30-minute mock interview** for the **{school} MBA** program,
based on the most frequently asked questions appearing in recent candidate
reports.

Return **strict JSON only** in this schema:

{{
  "questions": [
    "Question 1?",
    …
    "Question 10?"
  ],
  "tone": "overall tone of the interviewer (e.g. friendly, probing)",
  "interviewer_type": "Current Student / Alumnus / AdCom"
}}"""

def call_perplexity(prompt: str) -> Dict[str, Any]:
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user",   "content": prompt}
        ],
        "temperature": 0.3
    }
    r = requests.post(ENDPOINT, headers=HEADERS, json=payload, timeout=40)
    r.raise_for_status()
    raw = r.json()["choices"][0]["message"]["content"]
    return json.loads(strip_fence(raw))

def assemble_document(school: str, data: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "school":           school,
        "duration_min":     30,
        "question_count":   len(data["questions"]),
        "questions":        data["questions"],
        "tone":             data["tone"],
        "interviewer_type": data["interviewer_type"]
    }

# -------------------------------------------------------------- main (CLI)
if __name__ == "__main__":
    school = os.getenv("SCHOOL_NAME", "NYU Stern")   # default for manual runs
    prompt = build_prompt(school)
    payload = call_perplexity(prompt)
    doc = assemble_document(school, payload)
    print(json.dumps(doc, indent=2, ensure_ascii=False))