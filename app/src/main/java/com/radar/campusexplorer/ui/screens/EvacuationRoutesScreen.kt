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
fun EvacuationRoutesScreen(
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
                text = "Approved Evacuation Routes",
                color = EmeraldGreen,
                fontSize = 18.sp,
                fontWeight = FontWeight.Black
            )

            Box(modifier = Modifier.size(40.dp))
        }

        // Primary Safe Zone Card
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            EmeraldGreen.copy(alpha = 0.2f),
                            CardNavyContainer
                        )
                    )
                )
                .border(2.dp, EmeraldGreen, RoundedCornerShape(16.dp))
                .padding(16.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.VerifiedUser, "Safe", tint = EmeraldGreen, modifier = Modifier.size(24.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "PRIMARY ASSEMBLY ZONE: COVERED COURT",
                        color = EmeraldGreen,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black
                    )
                }

                Text(
                    text = "Capacity: 1,500 Persons · Open Roof Air Flow · Zero Overhead Cable Risks",
                    color = TextWhite,
                    fontSize = 11.sp
                )
            }
        }

        // Step-by-Step Evacuation Steps
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = "Evacuation Sequence:",
                color = GoldenYellow,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold
            )

            EvacuationStepCard(
                step = "1",
                title = "Exit Classroom In Single File",
                description = "Walk briskly. Do not run, push, or carry heavy bags."
            )

            EvacuationStepCard(
                step = "2",
                title = "Follow Purple Arrow Route",
                description = "Use Staircase C-Left or B-Left. Avoid elevator shafts if applicable."
            )

            EvacuationStepCard(
                step = "3",
                title = "Proceed to Central Walkway",
                description = "Cross the main paved corridor directly into the Covered Court entry gates."
            )

            EvacuationStepCard(
                step = "4",
                title = "Report to Section Adviser",
                description = "Grade 10-A to gather at Section Banner A in Covered Court."
            )
        }
    }
}

@Composable
private fun EvacuationStepCard(step: String, title: String, description: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(CardNavyContainer)
            .border(1.dp, ElectricCyan.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
            .padding(12.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(ElectricCyan),
                contentAlignment = Alignment.Center
            ) {
                Text(step, color = TextDarkNavy, fontSize = 14.sp, fontWeight = FontWeight.Black)
            }

            Column {
                Text(title, color = TextWhite, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Text(description, color = TextMutedBlue, fontSize = 10.sp)
            }
        }
    }
}
