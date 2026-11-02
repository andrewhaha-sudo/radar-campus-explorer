package com.radar.campusexplorer.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.radar.campusexplorer.domain.model.HazardReport
import com.radar.campusexplorer.domain.model.ThreatLevel
import com.radar.campusexplorer.ui.components.ButtonStyle
import com.radar.campusexplorer.ui.components.RadarGameButton
import com.radar.campusexplorer.ui.theme.*

@Composable
fun ReportHazardScreen(
    onBackClick: () -> Unit,
    onSubmitReport: (HazardReport) -> Unit,
    modifier: Modifier = Modifier
) {
    var selectedCategory by remember { mutableStateOf("Earthquake Crack") }
    var selectedSeverity by remember { mutableStateOf(ThreatLevel.WARNING) }
    var locationInput by remember { mutableStateOf("Building C - 2nd Floor Corridor") }
    var descriptionInput by remember { mutableStateOf("Hairline crack observed near window column. Needs inspection.") }
    var isSubmitted by remember { mutableStateOf(false) }

    val categories = listOf("Earthquake Crack", "Electrical Risk", "Blocked Exit", "Water Leak", "Structural Risk")

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
                text = "Report Campus Hazard",
                color = GoldenYellow,
                fontSize = 18.sp,
                fontWeight = FontWeight.Black
            )

            Box(modifier = Modifier.size(40.dp))
        }

        if (isSubmitted) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .clip(RoundedCornerShape(16.dp))
                    .background(CardNavyContainer)
                    .border(2.dp, EmeraldGreen, RoundedCornerShape(16.dp))
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = "Submitted",
                        tint = EmeraldGreen,
                        modifier = Modifier.size(64.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Hazard Report Submitted Successfully!",
                        color = TextWhite,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Thank you for keeping San Roque NHS safe. DRRM team has been notified.",
                        color = TextMutedBlue,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    RadarGameButton(
                        text = "Return to Campus Map",
                        icon = Icons.Default.Map,
                        style = ButtonStyle.GOLD,
                        onClick = onBackClick
                    )
                }
            }
        } else {
            // Form Container
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .clip(RoundedCornerShape(16.dp))
                    .background(CardNavyContainer)
                    .border(1.5.dp, ElectricCyan, RoundedCornerShape(16.dp))
                    .padding(16.dp)
            ) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Category Selection
                    Text(
                        text = "Hazard Category:",
                        color = TextWhite,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        categories.forEach { cat ->
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (selectedCategory == cat) GoldenYellow else DarkNavyBg)
                                    .border(1.dp, ElectricCyan, RoundedCornerShape(8.dp))
                                    .clickable { selectedCategory = cat }
                                    .padding(horizontal = 8.dp, vertical = 6.dp)
                            ) {
                                Text(
                                    text = cat,
                                    color = if (selectedCategory == cat) TextDarkNavy else TextWhite,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }

                    // Severity Selector
                    Text(
                        text = "Severity Level:",
                        color = TextWhite,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        ThreatLevel.entries.forEach { level ->
                            val color = when (level) {
                                ThreatLevel.NORMAL -> EmeraldGreen
                                ThreatLevel.ADVISORY -> GoldenYellow
                                ThreatLevel.WARNING -> GoldenYellow
                                ThreatLevel.CRITICAL -> EmergencyRed
                            }
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (selectedSeverity == level) color else DarkNavyBg)
                                    .border(1.dp, color, RoundedCornerShape(8.dp))
                                    .clickable { selectedSeverity = level }
                                    .padding(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Text(
                                    text = level.name,
                                    color = if (selectedSeverity == level) TextDarkNavy else color,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }

                    // Location Input
                    Text(
                        text = "Location / Building:",
                        color = TextWhite,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                    OutlinedTextField(
                        value = locationInput,
                        onValueChange = { locationInput = it },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextWhite,
                            unfocusedTextColor = TextWhite,
                            focusedBorderColor = ElectricCyan,
                            unfocusedBorderColor = TextMutedBlue
                        )
                    )

                    // Description Input
                    Text(
                        text = "Description & Details:",
                        color = TextWhite,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                    OutlinedTextField(
                        value = descriptionInput,
                        onValueChange = { descriptionInput = it },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 3,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextWhite,
                            unfocusedTextColor = TextWhite,
                            focusedBorderColor = ElectricCyan,
                            unfocusedBorderColor = TextMutedBlue
                        )
                    )
                }
            }

            // Submit Button
            RadarGameButton(
                text = "SUBMIT HAZARD REPORT",
                icon = Icons.Default.Send,
                style = ButtonStyle.GOLD,
                height = 50.dp,
                onClick = {
                    val report = HazardReport(
                        id = "HAZ-${System.currentTimeMillis() % 10000}",
                        title = selectedCategory,
                        category = selectedCategory,
                        severity = selectedSeverity,
                        location = locationInput,
                        buildingId = "c",
                        reporterName = "Alex Santos",
                        timestamp = "Just Now",
                        description = descriptionInput,
                        status = "Under Review"
                    )
                    onSubmitReport(report)
                    isSubmitted = true
                },
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}
