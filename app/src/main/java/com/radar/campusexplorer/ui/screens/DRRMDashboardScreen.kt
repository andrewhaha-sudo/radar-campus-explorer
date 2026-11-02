package com.radar.campusexplorer.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.radar.campusexplorer.ui.components.ButtonStyle
import com.radar.campusexplorer.ui.components.RadarGameButton
import com.radar.campusexplorer.ui.theme.*

@Composable
fun DRRMDashboardScreen(
    onBackClick: () -> Unit,
    modifier: Modifier = Modifier
) {
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
                text = "DRRM School Command Dashboard",
                color = GoldenYellow,
                fontSize = 18.sp,
                fontWeight = FontWeight.Black
            )

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(EmeraldGreen.copy(alpha = 0.2f))
                    .border(1.dp, EmeraldGreen, RoundedCornerShape(8.dp))
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Text("COMMAND ACTIVE", color = EmeraldGreen, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
        }

        // Metrics Grid
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            DashCard("Total Rooms", "28 Rooms", Icons.Default.MeetingRoom, ElectricCyan, Modifier.weight(1f))
            DashCard("Inspected", "26 (92%)", Icons.Default.CheckCircle, EmeraldGreen, Modifier.weight(1f))
            DashCard("Active Hazards", "2 Hazards", Icons.Default.Warning, GoldenYellow, Modifier.weight(1f))
            DashCard("Evacuation Readiness", "100% Ready", Icons.Default.Shield, EmeraldGreen, Modifier.weight(1f))
        }

        // Recent Incident Log
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .clip(RoundedCornerShape(16.dp))
                .background(CardNavyContainer)
                .border(1.5.dp, ElectricCyan, RoundedCornerShape(16.dp))
                .padding(14.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Recent School Safety Activities:",
                    color = TextWhite,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )

                LogItem(
                    title = "Building C Room 101 AI Inspection Complete",
                    time = "Today 10:15 AM",
                    status = "Passed (Score 96%)",
                    statusColor = EmeraldGreen
                )

                LogItem(
                    title = "Building C 2nd Floor Plaster Crack Reported",
                    time = "Jan 13 11:15 AM",
                    status = "Under Review",
                    statusColor = GoldenYellow
                )

                LogItem(
                    title = "Quarterly Evacuation Drill Pre-Check",
                    time = "Jan 12 02:00 PM",
                    status = "Verified Clear",
                    statusColor = EmeraldGreen
                )
            }
        }
    }
}

@Composable
private fun DashCard(
    title: String,
    value: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    color: Color,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(CardNavyContainer)
            .border(1.dp, color, RoundedCornerShape(12.dp))
            .padding(10.dp)
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(icon, title, tint = color, modifier = Modifier.size(20.dp))
            Spacer(modifier = Modifier.height(4.dp))
            Text(value, color = TextWhite, fontSize = 12.sp, fontWeight = FontWeight.Black)
            Text(title, color = TextMutedBlue, fontSize = 9.sp)
        }
    }
}

@Composable
private fun LogItem(title: String, time: String, status: String, statusColor: Color) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(DarkNavyBg)
            .padding(10.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(title, color = TextWhite, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                Text(time, color = TextMutedBlue, fontSize = 9.sp)
            }
            Text(status, color = statusColor, fontSize = 10.sp, fontWeight = FontWeight.Bold)
        }
    }
}
