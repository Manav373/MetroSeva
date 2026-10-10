package com.metro.cte.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Local outbox queue entity.
 * Guarantees zero data loss during offline station operations (up to 72 hours).
 */
@Entity(tableName = "outbox")
data class OutboxEntity(
    @PrimaryKey val id: String,
    val opType: String, // upsert, review_event
    val payloadJson: String,
    val createdAt: String,
    val attempts: Int = 0,
    val lastError: String? = null,
    val priority: String = "P3",
    val idempotencyKey: String
)
