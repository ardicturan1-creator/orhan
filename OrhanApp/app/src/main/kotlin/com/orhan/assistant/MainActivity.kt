package com.orhan.assistant

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.orhan.assistant.data.ApiHandler
import com.orhan.assistant.data.ChatManager
import com.orhan.assistant.data.SecureStorage
import com.orhan.assistant.ui.ChatScreen
import com.orhan.assistant.ui.theme.OrhanTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // State ve servisler burada oluşturulup ChatScreen'e enjekte edilir;
        // ileride bir ViewModel katmanına taşınması bu izolasyon sayesinde kolaydır.
        val chatManager = ChatManager()
        val apiHandler = ApiHandler()
        val secureStorage = SecureStorage(applicationContext)

        setContent {
            OrhanTheme {
                ChatScreen(
                    chatManager = chatManager,
                    apiHandler = apiHandler,
                    secureStorage = secureStorage
                )
            }
        }
    }
}
