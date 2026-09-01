package com.orhan.assistant.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.orhan.assistant.ui.theme.OrhanTextDim

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsSheet(
    initialKey: String,
    onSave: (String) -> Unit,
    onClear: () -> Unit,
    onDismiss: () -> Unit
) {
    var keyValue by remember { mutableStateOf(initialKey) }
    var visible by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(modifier = Modifier.padding(20.dp)) {
            Text("Ayarlar", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(6.dp))
            Text(
                "Kişisel API anahtarınızı girin. Anahtar, Android Keystore ile " +
                    "şifrelenerek yalnızca bu cihazda saklanır ve API çağrıları " +
                    "dışında hiçbir yere gönderilmez.",
                style = MaterialTheme.typography.bodySmall,
                color = OrhanTextDim
            )
            Spacer(Modifier.height(16.dp))
            OutlinedTextField(
                value = keyValue,
                onValueChange = { keyValue = it },
                label = { Text("API Anahtarı") },
                placeholder = { Text("nvapi-...") },
                singleLine = true,
                visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                trailingIcon = {
                    IconButton(onClick = { visible = !visible }) {
                        Icon(
                            imageVector = if (visible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            contentDescription = "Göster/Gizle"
                        )
                    }
                },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(20.dp))
            Row(modifier = Modifier.fillMaxWidth()) {
                OutlinedButton(
                    onClick = { keyValue = ""; onClear() },
                    modifier = Modifier.weight(1f)
                ) { Text("Temizle") }
                Spacer(Modifier.width(10.dp))
                Button(
                    onClick = { onSave(keyValue.trim()) },
                    modifier = Modifier.weight(1f)
                ) { Text("Kaydet") }
            }
            Spacer(Modifier.height(12.dp))
        }
    }
}
