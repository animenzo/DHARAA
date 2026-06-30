# ai-service/routers/chat.py

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from services.nvidia_service import (
    smart_chat,
    detect_grow_intent,
    crop_intent_guidance,
    is_available,
)

router = APIRouter(prefix="/chat", tags=["Chat"])


class ChatRequest(BaseModel):
    message:  str
    language: Optional[str] = "en"
    history:  Optional[list] = []
    context:  Optional[dict] = {}


class ChatResponse(BaseModel):
    reply:        str
    language:     str
    powered_by:   str              # "llama" | "mock"
    intent:       Optional[str] = None   # "grow_crop" | None
    crop_guidance: Optional[dict] = None # structured data for a result card


@router.post("/", response_model=ChatResponse)
async def chat(payload: ChatRequest):
    lang = payload.language or "en"
    msg  = payload.message.strip()

    # ── 0. Cheap keyword check: "I want to grow X" intent ──────────────
    # This runs BEFORE the LLM call — fast, free, and lets us route to
    # a structured crop-guidance response instead of generic chat text.
    mentioned_crop = detect_grow_intent(msg)
    if mentioned_crop and is_available():
        guidance = await crop_intent_guidance(
            crop_mentioned = mentioned_crop,
            language       = lang,
            context        = payload.context or {},
        )
        if guidance and guidance.get("crop_name"):
            # Build a natural reply summary; the structured fields populate
            # a result card on the frontend (see crop-guidance-result type).
            if lang == "hi":
                reply = (
                    f"{guidance.get('crop_name')} उगाने के लिए सलाह तैयार है। "
                    f"नीचे विवरण देखें।"
                )
            else:
                reply = (
                    f"Here's guidance for growing {guidance.get('crop_name')} — "
                    f"see the details below."
                )
            return ChatResponse(
                reply         = reply,
                language      = lang,
                powered_by    = "llama",
                intent        = "grow_crop",
                crop_guidance = guidance,
            )

    # ── 1. Normal conversational chat — try Llama ──────────────────────
    if is_available():
        reply = await smart_chat(
            message  = msg,
            language = lang,
            history  = payload.history or [],
            context  = payload.context or {},
        )
        if reply:
            return ChatResponse(
                reply      = reply,
                language   = lang,
                powered_by = "llama"
            )

    # ── 2. Fallback to mock if Llama unavailable ────────────────────────
    msg_lower = msg.lower()
    if any(w in msg_lower for w in ["crop","grow","plant","fasal","बोना"]):
        reply = ("कृपया 'Crop Recommend' टूल का उपयोग करें।"
                 if lang == "hi" else
                 "Please use the 'Crop Recommend' tool for crop advice.")
    elif any(w in msg_lower for w in ["disease","bimari","बीमारी","spot"]):
        reply = ("'Disease Detect' टूल से फोटो अपलोड करें।"
                 if lang == "hi" else
                 "Upload a photo using the 'Disease Detect' tool.")
    elif any(w in msg_lower for w in ["water","irrigation","paani","पानी"]):
        reply = ("'सिंचाई सलाह' टूल का उपयोग करें।"
                 if lang == "hi" else
                 "Use the 'Irrigation' tool for watering advice.")
    else:
        reply = (f"आपने पूछा: '{msg}' — कृपया अपना प्रश्न दोबारा लिखें।"
                 if lang == "hi" else
                 f"You asked: '{msg}' — could you rephrase your question?")

    return ChatResponse(reply=reply, language=lang, powered_by="mock")