package com.orhan.assistant.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.orhan.assistant.data.ApiException
import com.orhan.assistant.data.ApiHandler
import com.orhan.assistant.data.ChatManager
import com.orhan.assistant.data.ChatMessage
import com.orhan.assistant.data.SecureStorage
import com.orhan.assistant.ui.theme.OrhanAccent
import com.orhan.assistant.ui.theme.OrhanAccentSoft
import com.orhan.assistant.ui.theme.OrhanBg
import com.orhan.assistant.ui.theme.OrhanBorder
import com.orhan.assistant.ui.theme.OrhanDanger
import com.orhan.assistant.ui.theme.OrhanSuccess
import com.orhan.assistant.ui.theme.OrhanSurface
import com.orhan.assistant.ui.theme.OrhanText
import com.orhan.assistant.ui.theme.OrhanTextDim
import com.orhan.assistant.ui.theme.OrhanTextFaint
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    chatManager: ChatManager,
    apiHandler: ApiHandler,
    secureStorage: SecureStorage
) {
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }
    val listState = rememberLazyListState()
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)

    var input by remember { mutableStateOf("") }
    var isSending by remember { mutableStateOf(false) }
    var showSettings by remember { mutableStateOf(false) }
    var apiKeyPresent by remember { mutableStateOf(secureStorage.getApiKey().isNotBlank()) }

    fun showError(msg: String) {
        scope.launch { snackbarHostState.showSnackbar(msg) }
    }

    fun send(text: String) {
        val trimmed = text.trim()
        if (trimmed.isEmpty() || isSending) return

        val key = secureStorage.getApiKey()
        if (key.isBlank()) {
            showError("Devam etmeden önce API anahtarınızı girin.")
            showSettings = true
            return
        }

        chatManager.addMessage("user", trimmed)
        input = ""
        isSending = true

        scope.launch {
            try {
                val context = chatManager.getContextWindow(10)
                val reply = apiHandler.sendMessage(context, key)
                chatManager.addMessage("assistant", reply)
            } catch (e: ApiException) {
                val msg = when {
                    e.code == "TIMEOUT" -> "İstek zaman aşımına uğradı. Bağlantınızı kontrol edip tekrar deneyin."
                    e.code == "NETWORK" -> e.message ?: "Bağlantı hatası."
                    e.code == "NO_KEY" -> "API anahtarı bulunamadı. Ayarlar'dan ekleyin."
                    e.status == 401 || e.status == 403 -> "API anahtarı geçersiz veya yetkisiz. Ayarlar'dan kontrol edin."
                    e.status == 429 -> "İstek limiti aşıldı. Kısa bir süre sonra tekrar deneyin."
                    e.status != null && e.status >= 500 -> "Sunucu tarafında bir sorun oluştu. Lütfen daha sonra tekrar deneyin."
                    else -> e.message ?: "Beklenmeyen bir hata oluştu."
                }
                showError(msg)
            } catch (e: Exception) {
                showError("Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.")
            } finally {
                isSending = false
            }
        }
    }

    if (showSettings) {
        SettingsSheet(
            initialKey = secureStorage.getApiKey(),
            onSave = { key ->
                if (key.isBlank()) {
                    showError("Anahtar alanı boş olamaz.")
                } else {
                    secureStorage.setApiKey(key)
                    apiKeyPresent = true
                    showSettings = false
                    showError("API anahtarı kaydedildi.")
                }
            },
            onClear = {
                secureStorage.clearApiKey()
                apiKeyPresent = false
                showError("API anahtarı temizlendi.")
            },
            onDismiss = { showSettings = false }
        )
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            HistoryDrawerContent(
                apiKeyPresent = apiKeyPresent,
                onNewChat = {
                    chatManager.reset()
                    scope.launch { drawerState.close() }
                },
                onSettingsClick = {
                    showSettings = true
                    scope.launch { drawerState.close() }
                }
            )
        }
    ) {
        Scaffold(
            snackbarHost = { SnackbarHost(snackbarHostState) },
            containerColor = OrhanBg,
            topBar = {
                TopAppBar(
                    title = { Text("Orhan", fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold) },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(Icons.Default.Menu, contentDescription = "Menü")
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = OrhanBg,
                        titleContentColor = OrhanText,
                        navigationIconContentColor = OrhanTextDim
                    )
                )
            },
            bottomBar = {
                Composer(
                    value = input,
                    onValueChange = { input = it },
                    onSend = { send(input) },
                    enabled = !isSending
                )
            }
        ) { padding ->
            if (chatManager.isEmpty()) {
                EmptyState(
                    modifier = Modifier.padding(padding),
                    onSuggestionClick = { input = it }
                )
            } else {
                LazyColumn(
                    state = listState,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    items(chatManager.messages, key = { it.id }) { msg ->
                        MessageBubble(msg)
                    }
                    if (isSending) {
                        item { TypingIndicator() }
                    }
                }
                LaunchedEffect(chatManager.messages.size, isSending) {
                    val target = chatManager.messages.size
                    if (target > 0) listState.animateScrollToItem(target - 1)
                }
            }
        }
    }
}

@Composable
private fun MessageBubble(msg: ChatMessage) {
    val isUser = msg.role == "user"
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(0.86f)
                .clip(RoundedCornerShape(16.dp))
                .background(if (isUser) OrhanAccentSoft else OrhanSurface)
                .padding(14.dp)
        ) {
            if (isUser) {
                Text(msg.content, color = OrhanText, fontSize = 15.sp)
            } else {
                MarkdownMessage(raw = msg.content, textColor = OrhanText)
            }
        }
    }
}

@Composable
private fun TypingIndicator() {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(16.dp))
                .background(OrhanSurface)
                .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            Text("Orhan düşünüyor…", color = OrhanTextDim, fontSize = 13.sp)
        }
    }
}

@Composable
private fun Composer(
    value: String,
    onValueChange: (String) -> Unit,
    onSend: () -> Unit,
    enabled: Boolean
) {
    Surface(color = OrhanBg) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.Bottom
        ) {
            OutlinedTextField(
                value = value,
                onValueChange = onValueChange,
                modifier = Modifier.weight(1f),
                placeholder = { Text("Orhan'a bir şey sor...") },
                maxLines = 6,
                shape = RoundedCornerShape(18.dp)
            )
            Spacer(Modifier.width(8.dp))
            FilledIconButton(
                onClick = onSend,
                enabled = enabled && value.isNotBlank(),
                colors = IconButtonDefaults.filledIconButtonColors(containerColor = OrhanAccent)
            ) {
                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Gönder")
            }
        }
    }
}

@Composable
private fun EmptyState(modifier: Modifier = Modifier, onSuggestionClick: (String) -> Unit) {
    val suggestions = listOf(
        "Bu Python fonksiyonundaki hatayı bulup düzeltmeme yardım et",
        "Yavaş çalışan bir SQL sorgusunu nasıl optimize edebilirim?",
        "Karmaşık bir teknik konuyu basit ve anlaşılır şekilde özetle",
        "Aşağıdaki metni daha profesyonel bir dille yeniden yaz"
    )
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("Merhaba, ben Orhan.", style = MaterialTheme.typography.headlineSmall, color = OrhanText)
        Spacer(Modifier.height(8.dp))
        Text(
            "Teknik bir sorunu çözmek, bir metni düzenlemek ya da bir konuyu netleştirmek için buradayım.",
            color = OrhanTextDim,
            textAlign = TextAlign.Center
        )
        Spacer(Modifier.height(20.dp))
        suggestions.forEach { s ->
            OutlinedButton(
                onClick = { onSuggestionClick(s) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp)
            ) {
                Text(s, fontSize = 13.sp)
            }
        }
    }
}

@Composable
private fun HistoryDrawerContent(
    apiKeyPresent: Boolean,
    onNewChat: () -> Unit,
    onSettingsClick: () -> Unit
) {
    ModalDrawerSheet(drawerContainerColor = OrhanSurface) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("Orhan", style = MaterialTheme.typography.titleMedium, color = OrhanText)
            Spacer(Modifier.height(16.dp))

            OutlinedButton(onClick = onNewChat, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Text("Yeni sohbet")
            }

            Spacer(Modifier.height(20.dp))
            Text("Bugün", style = MaterialTheme.typography.labelSmall, color = OrhanTextFaint)
            listOf("Docker compose hatası ayıklama", "API rate limit stratejisi").forEach {
                Text(it, color = OrhanTextDim, fontSize = 13.sp, modifier = Modifier.padding(vertical = 8.dp))
            }

            Spacer(Modifier.height(12.dp))
            Text("Önceki 7 gün", style = MaterialTheme.typography.labelSmall, color = OrhanTextFaint)
            listOf(
                "React state yönetimi karşılaştırması",
                "SQL injection önleme kontrol listesi",
                "Regex ile log ayrıştırma"
            ).forEach {
                Text(it, color = OrhanTextDim, fontSize = 13.sp, modifier = Modifier.padding(vertical = 8.dp))
            }

            Spacer(Modifier.height(24.dp))
            HorizontalDivider(color = OrhanBorder)
            Spacer(Modifier.height(10.dp))

            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 8.dp)) {
                Box(
                    modifier = Modifier
                        .size(7.dp)
                        .clip(RoundedCornerShape(50))
                        .background(if (apiKeyPresent) OrhanSuccess else OrhanDanger)
                )
                Spacer(Modifier.width(7.dp))
                Text(
                    if (apiKeyPresent) "Bağlı" else "Anahtar girilmedi",
                    color = OrhanTextFaint,
                    fontSize = 11.sp
                )
            }

            TextButton(onClick = onSettingsClick, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Default.Settings, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Text("Ayarlar", modifier = Modifier.weight(1f))
            }
        }
    }
}
