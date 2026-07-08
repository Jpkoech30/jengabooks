-- Delete orphaned HITL pending reviews where the linked M-Pesa transaction no longer exists
DELETE FROM pending_reviews pr
WHERE pr."linkedEntityType" = 'MPESA_TX'
  AND pr."linkedEntityId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM mpesa_transactions mt WHERE mt.id = pr."linkedEntityId"
  );
