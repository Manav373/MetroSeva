package com.metro.cte.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Room Entity representing a single complaint matching TRD Section 5.3 data model.
 * Encrypted at rest using SQLCipher.
 */
@Entity(tableName = "complaints")
data class ComplaintEntity(
    @PrimaryKey val id: String,
    val channel: String,
    val stationId: String,
    val receivedAt: String,
    val rawText: String,
    val rawImageRef: String? = null,
    val langDetected: String,
    val normalised: String,
    val deptPrimary: String,
    val deptSecondary: String? = null,
    val deptConf: Double,
    val urgency: Int,
    val priority: String, // P1, P2, P3, REVIEW
    val safetyHitsJson: String,
    val replyLang: String,
    val replyDraft: String,
    val replyStatus: String, // draft, approved, sent
    val dedupeKey: String,
    val duplicateOf: String? = null,
    val modelVersion: String,
    val ruleVersion: String,
    val updatedAt: String,
    val syncState: String // local, pending, synced
)
