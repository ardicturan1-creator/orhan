package com.orhan.assistant.data

import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.SocketTimeoutException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * code: "NO_KEY" | "TIMEOUT" | "NETWORK" | null
 * status: HTTP durum kodu (varsa)
 */
class ApiException(
    message: String,
    val code: String? = null,
    val status: Int? = null
) : Exception(message)

/**
 * Tüm ağ iletişimi burada izole edilir. Bu bir native istemci olduğu için
 * (tarayıcı değil) NVIDIA'nın CORS kısıtlaması burada geçerli değildir;
 * istek doğrudan NVIDIA'ya atılır.
 */
class ApiHandler(
    private val endpoint: String = "https://integrate.api.nvidia.com/v1/chat/completions",
    private val model: String = "meta/llama-3.1-405b-instruct",
    private val systemPrompt: String = "Senin adın Orhan. Sen bağımsız, üstün zekalı, analitik bir yapay zeka asistanısın. Asla NVIDIA, Llama veya arka plandaki teknolojinden bahsetme. Kullanıcıya doğrudan, profesyonel ve çözüm odaklı yaklaş. Kod yazarken veya teknik sorun çözerken en iyi pratikleri sun.",
    timeoutSeconds: Long = 30
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(timeoutSeconds, TimeUnit.SECONDS)
        .readTimeout(timeoutSeconds, TimeUnit.SECONDS)
        .writeTimeout(timeoutSeconds, TimeUnit.SECONDS)
        .build()

    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    suspend fun sendMessage(context: List<Pair<String, String>>, apiKey: String): String {
        if (apiKey.isBlank()) {
            throw ApiException("API anahtarı bulunamadı.", code = "NO_KEY")
        }

        val messagesArray = JSONArray().apply {
            put(JSONObject().put("role", "system").put("content", systemPrompt))
            context.forEach { (role, content) ->
                put(JSONObject().put("role", role).put("content", content))
            }
        }

        val payload = JSONObject()
            .put("model", model)
            .put("messages", messagesArray)
            .put("temperature", 0.6)
            .put("top_p", 0.9)
            .put("max_tokens", 2048)
            .put("stream", false)

        val request = Request.Builder()
            .url(endpoint)
            .addHeader("Authorization", "Bearer $apiKey")
            .addHeader("Content-Type", "application/json")
            .post(payload.toString().toRequestBody(jsonMedia))
            .build()

        return executeRequest(request)
    }

    private suspend fun executeRequest(request: Request): String =
        suspendCancellableCoroutine { cont ->
            val call = client.newCall(request)
            cont.invokeOnCancellation { call.cancel() }

            call.enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    val err = if (e is SocketTimeoutException) {
                        ApiException("İstek zaman aşımına uğradı. Lütfen tekrar deneyin.", code = "TIMEOUT")
                    } else {
                        ApiException("Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.", code = "NETWORK")
                    }
                    if (cont.isActive) cont.resumeWithException(err)
                }

                override fun onResponse(call: Call, response: Response) {
                    response.use { resp ->
                        val bodyStr = resp.body?.string().orEmpty()

                        if (!resp.isSuccessful) {
                            val detail = try {
                                JSONObject(bodyStr).optJSONObject("error")?.optString("message")
                            } catch (e: Exception) {
                                null
                            }
                            if (cont.isActive) {
                                cont.resumeWithException(
                                    ApiException(
                                        detail ?: "İstek başarısız oldu (HTTP ${resp.code}).",
                                        status = resp.code
                                    )
                                )
                            }
                            return
                        }

                        try {
                            val content = JSONObject(bodyStr)
                                .getJSONArray("choices")
                                .getJSONObject(0)
                                .getJSONObject("message")
                                .getString("content")
                            if (cont.isActive) cont.resume(content)
                        } catch (e: Exception) {
                            if (cont.isActive) {
                                cont.resumeWithException(ApiException("Sunucudan beklenmeyen bir yanıt formatı geldi."))
                            }
                        }
                    }
                }
            })
        }
}
