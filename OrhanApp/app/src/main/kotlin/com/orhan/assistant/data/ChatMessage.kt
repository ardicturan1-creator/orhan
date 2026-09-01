package com.orhan.assistant.data

import java.util.UUID

data class ChatMessage(
    val id: String = UUID.randomUUID().toString(),
    val role: String,       // "user" veya "assistant"
    val content: String,
    val timestamp: Long = System.currentTimeMillis()
)
