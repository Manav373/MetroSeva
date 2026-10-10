package com.metro.cte.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Local Outbox Table for offline operations (TRD Section 5.3 & 5.5).
 * Stores local reviews, replies, and paper OCR complaints until connectivity is restored.
 */
@Entity(tableName = "outbox")
data class OutboxEntity(
    @PrimaryKey
    val id: String,
    val idempotencyKey: String,
    val opType: String,       // CREATE_COMPLAINT, REVIEW_COMPLAINT, APPROVE_REPLY
    val payloadJson: String,
    val createdAt: Long,
    val attempts: Int = 0,
    val lastError: String? = null,
    val synced: Boolean = false
)
