package com.orhan.assistant.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val OrhanBg = Color(0xFF121212)
val OrhanSurface = Color(0xFF1E1E1E)
val OrhanSurface2 = Color(0xFF242424)
val OrhanSurface3 = Color(0xFF2B2B2B)
val OrhanBorder = Color(0xFF2E2E2E)

val OrhanText = Color(0xFFEAE7E4)
val OrhanTextDim = Color(0xFF9C9997)
val OrhanTextFaint = Color(0xFF6B6866)

val OrhanAccent = Color(0xFF9E3A47)
val OrhanAccentStrong = Color(0xFFB54B58)
val OrhanAccentSoft = Color(0x299E3A47)

val OrhanDanger = Color(0xFFD6564F)
val OrhanSuccess = Color(0xFF45A578)

private val OrhanColorScheme = darkColorScheme(
    background = OrhanBg,
    surface = OrhanSurface,
    primary = OrhanAccent,
    onPrimary = Color.White,
    onBackground = OrhanText,
    onSurface = OrhanText,
    error = OrhanDanger
)

@Composable
fun OrhanTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = OrhanColorScheme,
        content = content
    )
}
