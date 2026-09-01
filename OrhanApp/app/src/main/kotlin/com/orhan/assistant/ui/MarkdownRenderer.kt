package com.orhan.assistant.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.orhan.assistant.ui.theme.OrhanSuccess
import com.orhan.assistant.ui.theme.OrhanTextDim
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private sealed class MdBlock {
    data class Text(val content: String) : MdBlock()
    data class Code(val lang: String, val code: String) : MdBlock()
}

private fun parseBlocks(raw: String): List<MdBlock> {
    val blocks = mutableListOf<MdBlock>()
    val regex = Regex("```(\\w*)\\n?([\\s\\S]*?)```")
    var lastIndex = 0

    for (match in regex.findAll(raw)) {
        if (match.range.first > lastIndex) {
            val textPart = raw.substring(lastIndex, match.range.first)
            if (textPart.isNotBlank()) blocks.add(MdBlock.Text(textPart))
        }
        val lang = match.groupValues[1].ifBlank { "metin" }
        val code = match.groupValues[2].trimEnd('\n')
        blocks.add(MdBlock.Code(lang, code))
        lastIndex = match.range.last + 1
    }

    if (lastIndex < raw.length) {
        val rest = raw.substring(lastIndex)
        if (rest.isNotBlank()) blocks.add(MdBlock.Text(rest))
    }
    if (blocks.isEmpty() && raw.isNotBlank()) blocks.add(MdBlock.Text(raw))
    return blocks
}

/** `**kalın**`, `*italik*` ve `` `satır içi kod` `` biçimlerini işler. */
private fun parseInline(text: String): AnnotatedString = buildAnnotatedString {
    var i = 0
    val n = text.length
    while (i < n) {
        when {
            text.startsWith("**", i) -> {
                val end = text.indexOf("**", i + 2)
                if (end != -1) {
                    withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
                        append(text.substring(i + 2, end))
                    }
                    i = end + 2
                } else {
                    append(text[i]); i++
                }
            }
            text[i] == '`' -> {
                val end = text.indexOf('`', i + 1)
                if (end != -1) {
                    withStyle(
                        SpanStyle(
                            fontFamily = FontFamily.Monospace,
                            background = Color(0xFF2B2B2B),
                            fontSize = 13.sp
                        )
                    ) { append(text.substring(i + 1, end)) }
                    i = end + 1
                } else {
                    append(text[i]); i++
                }
            }
            text[i] == '*' -> {
                val end = text.indexOf('*', i + 1)
                if (end != -1) {
                    withStyle(SpanStyle(fontStyle = FontStyle.Italic)) {
                        append(text.substring(i + 1, end))
                    }
                    i = end + 1
                } else {
                    append(text[i]); i++
                }
            }
            else -> {
                append(text[i]); i++
            }
        }
    }
}

@Composable
fun MarkdownMessage(raw: String, textColor: Color) {
    val blocks = remember(raw) { parseBlocks(raw) }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        blocks.forEach { block ->
            when (block) {
                is MdBlock.Text -> Text(
                    text = parseInline(block.content.trim()),
                    color = textColor,
                    fontSize = 15.sp,
                    lineHeight = 22.sp
                )
                is MdBlock.Code -> CodeBlock(block.lang, block.code)
            }
        }
    }
}

@Composable
private fun CodeBlock(lang: String, code: String) {
    val clipboard = LocalClipboardManager.current
    var copied by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(11.dp))
            .background(Color(0xFF161616))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF1A1A1A))
                .padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(lang, color = OrhanTextDim, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
            TextButton(onClick = {
                clipboard.setText(AnnotatedString(code))
                copied = true
                scope.launch { delay(1800); copied = false }
            }) {
                Icon(
                    imageVector = if (copied) Icons.Default.Check else Icons.Default.ContentCopy,
                    contentDescription = null,
                    tint = if (copied) OrhanSuccess else OrhanTextDim,
                    modifier = Modifier.width(14.dp)
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    if (copied) "Kopyalandı" else "Kopyala",
                    color = if (copied) OrhanSuccess else OrhanTextDim,
                    fontSize = 11.sp
                )
            }
        }
        SelectionContainer {
            Text(
                text = code,
                color = Color(0xFFDCD8D4),
                fontFamily = FontFamily.Monospace,
                fontSize = 13.sp,
                lineHeight = 20.sp,
                modifier = Modifier.padding(14.dp)
            )
        }
    }
}
