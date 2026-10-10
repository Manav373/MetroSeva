package com.metro.cte.data

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface ComplaintDao {
    @Query("""
        SELECT * FROM complaints 
        WHERE (:dept IS NULL OR deptPrimary = :dept)
        ORDER BY 
            CASE WHEN priority = 'P1' THEN 0 WHEN priority = 'P2' THEN 1 ELSE 2 END,
            urgency DESC,
            receivedAt DESC
    """)
    fun getPrioritizedQueue(dept: String? = null): Flow<List<ComplaintEntity>>

    @Query("SELECT * FROM complaints WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): ComplaintEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertComplaint(complaint: ComplaintEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOutbox(outbox: OutboxEntity)

    @Transaction
    suspend fun saveTriageWithOutbox(complaint: ComplaintEntity, outbox: OutboxEntity) {
        insertComplaint(complaint)
        insertOutbox(outbox)
    }

    @Query("UPDATE complaints SET replyStatus = :status, replyDraft = :approvedDraft, syncState = 'pending' WHERE id = :id")
    suspend fun approveReply(id: String, approvedDraft: String, status: String = "approved")
}
