package com.radar.campusexplorer.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.radar.campusexplorer.domain.model.AlertItem
import com.radar.campusexplorer.domain.model.ThreatLevel
import com.radar.campusexplorer.ui.components.ButtonStyle
import com.radar.campusexplorer.ui.components.RadarGameButton
import com.radar.campusexplorer.ui.theme.*

@Composable
fun AlertsScreen(
    alerts: List<AlertItem>,
    onBackClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    var selectedFilter by remember { mutableStateOf("All") }

    val filteredAlerts = when (selectedFilter) {
        "Advisories" -> alerts.filter { it.severity == ThreatLevel.ADVISORY }
        "Warnings" -> alerts.filter { it.severity == ThreatLevel.WARNING }
        else -> alerts
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(DarkNavyBg)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Top Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            RadarGameButton(
                text = "Back",
                icon = Icons.Default.ArrowBack,
                onClick = onBackClick,
                style = ButtonStyle.NAVY
            )

            Text(
                text = "Disaster Alerts & Updates",
                color = GoldenYellow,
                fontSize = 18.sp,
                fontWeight = FontWeight.Black
            )

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(EmergencyRed)
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Text("${alerts.size} Active", color = TextWhite, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }

        // Filter Tabs
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            listOf("All", "Advisories", "Warnings").forEach { filter ->
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (selectedFilter == filter) GoldenYellow else CardNavyContainer)
                        .border(1.dp, ElectricCyan, RoundedCornerShape(10.dp))
                        .clickable { selectedFilter = filter }
                        .padding(horizontal = 14.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = filter,
                        color = if (selectedFilter == filter) TextDarkNavy else TextWhite,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        // Alerts List
        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(filteredAlerts) { alert ->
                AlertCardItem(alert = alert)
            }
        }
    }
}

@Composable
private fun AlertCardItem(alert: AlertItem) {
    val borderColor = when (alert.severity) {
        ThreatLevel.NORMAL -> EmeraldGreen
        ThreatLevel.ADVISORY -> GoldenYellow
        ThreatLevel.WARNING -> GoldenYellow
        ThreatLevel.CRITICAL -> EmergencyRed
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(CardNavyContainer)
            .border(1.5.dp, borderColor, RoundedCornerShape(14.dp))
            .padding(14.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = alert.title,
                        tint = borderColor,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = alert.title,
                        color = TextWhite,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Text(
                    text = alert.timestamp,
                    color = TextMutedBlue,
                    fontSize = 10.sp
                )
            }

            Text(
                text = alert.description,
                color = TextMutedBlue,
                fontSize = 11.sp,
                lineHeight = 15.sp
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Issuer: ${alert.issuingAuthority}",
                    color = ElectricCyan,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = alert.affectedArea,
                    color = GoldenYellow,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}
