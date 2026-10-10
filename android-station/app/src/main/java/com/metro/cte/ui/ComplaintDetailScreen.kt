package com.metro.cte.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.metro.cte.data.ComplaintEntity

@Composable
fun ComplaintDetailScreen(
    complaint: ComplaintEntity,
    onApproveReply: (String) -> Unit,
    onBack: () -> Unit
) {
    var isApproving by remember { mutableStateOf(false) }
    var editedReply by remember { mutableStateOf(complaint.replyDraft) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Button(onClick = onBack) { Text("← Back to Queue") }

        Spacer(modifier = Modifier.height(16.dp))

        // Safety Alert Banner if P1
        if (complaint.priority == "P1") {
            Card(
                colors = CardDefaults.cardColors(containerColor = HighContrastP1Bg),
                border = androidx.compose.foundation.BorderStroke(2.dp, HighContrastP1Red),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "🚨 SAFETY CRITICAL (P1)",
                        color = HighContrastP1Red,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                    Text(
                        text = "Safety floor active: Rules triggered = ${complaint.safetyHitsJson}",
                        color = HighContrastP1Red,
                        fontSize = 13.sp
                    )
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
        }

        // Section: Raw Complaint
        Text("Raw Complainant Submission (Immutable):", fontWeight = FontWeight.Bold)
        Card(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
            Text(complaint.rawText, modifier = Modifier.padding(12.dp))
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Section: Normalized Text & Language
        Text("Normalized / Gujlish Transliteration:", fontWeight = FontWeight.Bold)
        Card(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
            Text(complaint.normalised, modifier = Modifier.padding(12.dp))
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Section: Draft Response (Complainant Language)
        Text("Draft Reply (${complaint.replyLang.uppercase()}):", fontWeight = FontWeight.Bold)
        OutlinedTextField(
            value = editedReply,
            onValueChange = { editedReply = it },
            modifier = Modifier.fillMaxWidth().height(150.dp).padding(vertical = 8.dp),
            label = { Text("Response Text (Controller Review)") }
        )

        Spacer(modifier = Modifier.height(16.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Button(
                onClick = { onApproveReply(editedReply) },
                colors = ButtonDefaults.buttonColors(containerColor = HighContrastP1Red),
                modifier = Modifier.weight(1f)
            ) {
                Text("Approve & Send to Outbox", fontWeight = FontWeight.Bold)
            }
        }
    }
}
