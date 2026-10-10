package com.metro.cte.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Room entity for storing triaged complaints locally on Android station tablets (TRD Section 5.3).
 * Enables 100% offline querying and station controller review.
 */
@Entity(tableName = "complaints")
data class ComplaintEntity(
    @PrimaryKey
    val id: String,
    val stationId: String,
    val channel: String,         // app, social, email, paper
    val rawText: String,
    val normalised: String?,
    val deptPrimary: String,     // safety, cleanliness, fare, lifts_escalators, staff_behaviour, other
    val deptSecondary: String?,
    val deptConf: Float,
    val urgency: Int,            // 0..100
    val priority: String,        // P1, P2, P3, REVIEW
    val safetyHitsJson: String?, // Array of matched safety rules
    val replyLang: String,       // gu, hi, en, gu-latn
    val replyDraft: String?,
    val replyStatus: String,     // draft, approved, sent
    val dedupeKey: String?,
    val duplicateOf: String?,
    val modelVersion: String,
    val ruleVersion: String,
    val syncState: String,       // local, pending, synced
    val createdAt: Long,
    val updatedAt: Long
)
