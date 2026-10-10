package com.metro.cte.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.metro.cte.data.ComplaintEntity

val HighContrastP1Red = Color(0xFFD32F2F)
val HighContrastP1Bg = Color(0xFFFFEBEE)
val P2Orange = Color(0xFFF57C00)
val P3Green = Color(0xFF388E3C)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QueueScreen(
    complaints: List<ComplaintEntity>,
    onSelectComplaint: (ComplaintEntity) -> Unit,
    onTabSelected: (String?) -> Unit,
    currentTab: String?
) {
    val tabs = listOf(
        null to "All",
        "safety" to "Safety",
        "cleanliness" to "Cleanliness",
        "fare" to "Fare",
        "lifts_escalators" to "Lifts/Esc",
        "staff_behaviour" to "Staff"
    )

    Column(modifier = Modifier.fillMaxSize().background(Color(0xFFF5F5F5))) {
        // Department Tabs
        ScrollableTabRow(
            selectedTabIndex = tabs.indexOfFirst { it.first == currentTab }.coerceAtLeast(0),
            edgePadding = 16.dp
        ) {
            tabs.forEach { (deptId, title) ->
                Tab(
                    selected = currentTab == deptId,
                    onClick = { onTabSelected(deptId) },
                    text = { Text(title, fontWeight = FontWeight.SemiBold) }
                )
            }
        }

        // Complaint List
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(complaints, key = { it.id }) { complaint ->
                ComplaintCard(complaint = complaint, onClick = { onSelectComplaint(complaint) })
            }
        }
    }
}

@Composable
fun ComplaintCard(complaint: ComplaintEntity, onClick: () -> Unit) {
    val isP1 = complaint.priority == "P1"
    val cardBg = if (isP1) HighContrastP1Bg else Color.White
    val borderColor = if (isP1) HighContrastP1Red else Color(0xFFE0E0E0)

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        colors = CardDefaults.cardColors(containerColor = cardBg),
        border = androidx.compose.foundation.BorderStroke(if (isP1) 2.dp else 1.dp, borderColor)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Priority Badge
                Surface(
                    color = if (isP1) HighContrastP1Red else if (complaint.priority == "P2") P2Orange else P3Green,
                    shape = MaterialTheme.shapes.small
                ) {
                    Text(
                        text = complaint.priority,
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        fontSize = 12.sp
                    )
                }

                Text(
                    text = "Score: ${complaint.urgency}/100",
                    fontWeight = FontWeight.Bold,
                    color = if (isP1) HighContrastP1Red else Color.Black
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = complaint.rawText,
                fontWeight = FontWeight.Medium,
                maxLines = 2,
                fontSize = 15.sp
            )

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Lang: ${complaint.langDetected.uppercase()}",
                    fontSize = 12.sp,
                    color = Color.Gray
                )
                Text(
                    text = "Dept: ${complaint.deptPrimary.replace('_', ' ').uppercase()}",
                    fontSize = 12.sp,
                    color = Color.Gray
                )
            }
        }
    }
}
