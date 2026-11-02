package com.radar.campusexplorer

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.radar.campusexplorer.ui.screens.HomeScreen
import com.radar.campusexplorer.ui.theme.RadarTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate()
        enableEdgeToEdge()
        setContent {
            RadarTheme {
                HomeScreen()
            }
        }
    }
}
