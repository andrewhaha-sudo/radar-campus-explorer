package com.radar.campusexplorer.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Divider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.radar.campusexplorer.domain.model.DisasterWatchItem
import com.radar.campusexplorer.domain.model.ThreatLevel
import com.radar.campusexplorer.domain.model.WeatherState
import com.radar.campusexplorer.ui.theme.*

@Composable
fun RadarLiveConditionsCard(
    weather: WeatherState,
    disasterWatch: List<DisasterWatchItem>,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .width(220.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        CardNavyContainer,
                        DarkNavyBg
                    )
                )
            )
            .border(1.5.dp, ElectricCyan, RoundedCornerShape(16.dp))
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // --- Live Conditions Section ---
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(6.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(ElectricCyan)
                )
                Text(
                    text = "Live Conditions",
                    color = TextWhite,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Icon(
                    imageVector = Icons.Default.Cloud,
                    contentDescription = "Weather Icon",
                    tint = ElectricCyan,
                    modifier = Modifier.size(32.dp)
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Thermostat,
                        contentDescription = "Temperature",
                        tint = EmergencyRed,
                        modifier = Modifier.size(14.dp)
                    )
                    Text(
                        text = "${weather.temperatureC} °C",
                        color = TextWhite,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Black
                    )
                }
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = weather.condition,
                    color = TextWhite,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Air,
                        contentDescription = "Wind",
                        tint = TextMutedBlue,
                        modifier = Modifier.size(12.dp)
                    )
                    Spacer(modifier = Modifier.width(2.dp))
                    Text(
                        text = "Wind: ${weather.windKmH} km/h",
                        color = TextMutedBlue,
                        fontSize = 9.sp
                    )
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.WaterDrop,
                        contentDescription = "Humidity",
                        tint = ElectricCyan,
                        modifier = Modifier.size(12.dp)
                    )
                    Spacer(modifier = Modifier.width(2.dp))
                    Text(
                        text = "Humidity: ${weather.humidityPercent}%",
                        color = TextMutedBlue,
                        fontSize = 9.sp
                    )
                }
            }
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(ElectricCyan.copy(alpha = 0.3f))
        )

        // --- Disaster Watch (PAGASA & PHIVOLCS) Section ---
        Column(
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = "Disaster Watch (PAGASA & PHIVOLCS)",
                color = TextWhite,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold
            )

            disasterWatch.forEach { item ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        val (iconTint, iconVector) = when (item.threatLevel) {
                            ThreatLevel.NORMAL -> Pair(EmeraldGreen, Icons.Default.CheckCircle)
                            ThreatLevel.ADVISORY -> Pair(GoldenYellow, Icons.Default.Warning)
                            ThreatLevel.WARNING -> Pair(GoldenYellow, Icons.Default.Warning)
                            ThreatLevel.CRITICAL -> Pair(EmergencyRed, Icons.Default.Error)
                        }
                        Icon(
                            imageVector = iconVector,
                            contentDescription = item.category,
                            tint = iconTint,
                            modifier = Modifier.size(12.dp)
                        )
                        Text(
                            text = item.category,
                            color = TextWhite,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }

                    val badgeColor = when (item.threatLevel) {
                        ThreatLevel.NORMAL -> EmeraldGreen
                        ThreatLevel.ADVISORY -> GoldenYellow
                        ThreatLevel.WARNING -> GoldenYellow
                        ThreatLevel.CRITICAL -> EmergencyRed
                    }

                    Text(
                        text = item.statusText,
                        color = badgeColor,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}
