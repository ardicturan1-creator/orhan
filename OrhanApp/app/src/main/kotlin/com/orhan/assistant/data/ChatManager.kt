package com.orhan.assistant.data

import androidx.compose.runtime.mutableStateListOf

/**
 * Sohbet durumunu tutan izole state sınıfı. UI'dan (Compose) bağımsızdır;
 * ileride bir ViewModel'e veya başka bir mimariye taşınması kolaydır.
 */
class ChatManager {
    val messages = mutableStateListOf<ChatMessage>()

    fun addMessage(role: String, content: String): ChatMessage {
        val msg = ChatMessage(role = role, content = content)
        messages.add(msg)
        return msg
    }

    /** API'ye gönderilecek bağlamı son [limit] mesajla sınırlar. */
    fun getContextWindow(limit: Int = 10): List<Pair<String, String>> {
        return messages.takeLast(limit).map { it.role to it.content }
    }

    fun reset() {
        messages.clear()
    }

    fun isEmpty(): Boolean = messages.isEmpty()
}
