export interface Profile {
  id: string
  email: string
  first_name: string
  last_name: string
  forwarding_address: string
  digest_time: string
  timezone: string
  is_active: boolean
  created_at: string
}

export interface Newsletter {
  id: string
  user_id: string
  sender_email: string
  sender_name: string | null
  subject: string
  raw_content: string
  summary: string | null
  extracted_links: ExtractedLink[]
  message_id: string | null
  received_at: string
  included_in_digest: boolean
  digest_sent_at: string | null
}

export interface ExtractedLink {
  url: string
  text: string
}

export interface BlockedSender {
  id: string
  user_id: string
  sender_email: string
  blocked_at: string
}

export interface DigestBatch {
  id: string
  user_id: string
  digest_date: string
  newsletter_ids: string[]
  sent_at: string
}
