package com.radar.campusexplorer.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
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
fun EmergencyScreen(
    onBackClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    var callConfirmTarget by remember { mutableStateOf<Pair<String, String>?>(null) }

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

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.PhoneInTalk,
                    contentDescription = "SOS",
                    tint = EmergencyRed,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "RADAR SOS Emergency Hub",
                    color = EmergencyRed,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Black
                )
            }

            Box(modifier = Modifier.size(40.dp))
        }

        // Protective Guidance Banner (DROP, COVER, HOLD)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(
                            EmergencyRed,
                            RedGlow
                        )
                    )
                )
                .border(2.dp, Color.White, RoundedCornerShape(14.dp))
                .padding(12.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(Color.White),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = "Alert",
                        tint = EmergencyRed,
                        modifier = Modifier.size(28.dp)
                    )
                }

                Column {
                    Text(
                        text = "EARTHQUAKE SAFETY: DROP, COVER, HOLD ON!",
                        color = TextWhite,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black
                    )
                    Text(
                        text = "Stay away from windows. Protect your head. Proceed calmly to Covered Court when clear.",
                        color = TextWhite.copy(alpha = 0.9f),
                        fontSize = 10.sp
                    )
                }
            }
        }

        // Active Location Coordinates Pill
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(CardNavyContainer)
                .border(1.dp, ElectricCyan, RoundedCornerShape(10.dp))
                .padding(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.MyLocation, "GPS", tint = ElectricCyan, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Your GPS: 14.5995° N, 120.9842° E (Building C)",
                        color = TextWhite,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(EmeraldGreen)
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text("BEACON ACTIVE", color = TextDarkNavy, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // Emergency Contacts Grid
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = "Verified Campus Emergency Contacts:",
                color = GoldenYellow,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold
            )

            ContactRow(
                title = "School Safety Office (DRRM Desk)",
                phone = "+63 917 555 0192",
                onCall = { callConfirmTarget = Pair("School Safety Office", "+63 917 555 0192") }
            )

            ContactRow(
                title = "Principal's Emergency Command",
                phone = "+63 918 222 0988",
                onCall = { callConfirmTarget = Pair("Principal's Office", "+63 918 222 0988") }
            )

            ContactRow(
                title = "Municipal Disaster Risk Reduction Office",
                phone = "911 / (02) 8888-0000",
                onCall = { callConfirmTarget = Pair("MDRRMO Hotline", "911") }
            )

            ContactRow(
                title = "Red Cross Emergency Response",
                phone = "143 / (02) 8527-0000",
                onCall = { callConfirmTarget = Pair("Red Cross", "143") }
            )
        }

        // Call Confirmation Dialog
        callConfirmTarget?.let { (name, phone) ->
            AlertDialog(
                onDismissRequest = { callConfirmTarget = null },
                title = { Text(text = "Confirm Emergency Call", color = TextWhite) },
                text = { Text(text = "Are you sure you want to call $name ($phone)?", color = TextMutedBlue) },
                confirmButton = {
                    TextButton(onClick = { callConfirmTarget = null }) {
                        Text("CALL NOW", color = EmergencyRed, fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { callConfirmTarget = null }) {
                        Text("Cancel", color = TextWhite)
                    }
                },
                containerColor = CardNavyContainer
            )
        }
    }
}

@Composable
private fun ContactRow(
    title: String,
    phone: String,
    onCall: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(CardNavyContainer)
            .border(1.dp, EmergencyRed.copy(alpha = 0.6f), RoundedCornerShape(12.dp))
            .padding(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(text = title, color = TextWhite, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                Text(text = phone, color = GoldenYellow, fontSize = 11.sp, fontWeight = FontWeight.Medium)
            }

            RadarGameButton(
                text = "CALL",
                icon = Icons.Default.Call,
                style = ButtonStyle.RED,
                onClick = onCall
            )
        }
    }
}
