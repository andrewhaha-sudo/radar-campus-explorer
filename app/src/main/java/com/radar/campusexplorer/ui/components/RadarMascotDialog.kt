package com.radar.campusexplorer.ui.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.SmartToy
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
import com.radar.campusexplorer.ui.theme.*

@Composable
fun RadarMascotDialog(
    modifier: Modifier = Modifier
) {
    val tips = remember {
        listOf(
            "Explore the campus, scan rooms, check hazards, and stay prepared!",
            "Did you know? In an earthquake: Drop, Cover, and Hold on!",
            "Check Building C to complete today's classroom safety inspection drill.",
            "Tap any building on the map to view its floor plan and safety status.",
            "In an emergency, tap the Coral Red SOS button to reach campus DRRM."
        )
    }

    var tipIndex by remember { mutableStateOf(0) }

    Row(
        modifier = modifier
            .clip(RoundedCornerShape(20.dp))
            .background(CardNavyContainer.copy(alpha = 0.95f))
            .border(1.5.dp, ElectricCyan, RoundedCornerShape(20.dp))
            .clickable { tipIndex = (tipIndex + 1) % tips.size }
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Pixel Mascot Avatar Badge (Original RADAR Assistant Avatar)
        Box(
            modifier = Modifier
                .size(42.dp)
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        colors = listOf(GoldenYellow, PurpleDark)
                    )
                )
                .border(1.5.dp, GoldenYellow, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.SmartToy,
                contentDescription = "RADAR Mascot",
                tint = TextWhite,
                modifier = Modifier.size(26.dp)
            )
        }

        Spacer(modifier = Modifier.width(8.dp))

        // Dialogue Bubble Container
        Column(
            modifier = Modifier.widthIn(max = 240.dp)
        ) {
            Text(
                text = "RADAR Assistant",
                color = GoldenYellow,
                fontSize = 11.sp,
                fontWeight = FontWeight.ExtraBold
            )

            AnimatedContent(
                targetState = tips[tipIndex],
                label = "tipAnimation"
            ) { currentTip ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = currentTip,
                        color = TextWhite,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Medium,
                        lineHeight = 12.sp,
                        maxLines = 2,
                        modifier = Modifier.weight(1f)
                    )
                    Icon(
                        imageVector = Icons.Default.ArrowDropDown,
                        contentDescription = "Next Tip",
                        tint = ElectricCyan,
                        modifier = Modifier.size(14.dp)
                    )
                }
            }
        }
    }
}
