-- Development Seed Data
-- WARNING: Only run this in development environment!

-- Clear existing data (in correct order due to foreign keys)
TRUNCATE TABLE usage_metrics, api_keys, activity_logs, documents, messages, conversations, oauth_providers, users, teams RESTART IDENTITY CASCADE;

-- Insert test teams
INSERT INTO teams (id, name, slug, owner_id, subscription_tier, subscription_status, max_members) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Acme Corp', 'acme-corp', '550e8400-e29b-41d4-a716-446655440011', 'professional', 'active', 20),
('550e8400-e29b-41d4-a716-446655440002', 'TechStart Inc', 'techstart-inc', '550e8400-e29b-41d4-a716-446655440012', 'starter', 'active', 10);

-- Insert test users
-- Password for all test users: "Password123!"
-- Hash generated with bcryptjs, 10 rounds
INSERT INTO users (id, email, password_hash, first_name, last_name, role, team_id, is_active, is_email_verified) VALUES
('550e8400-e29b-41d4-a716-446655440011', 'admin@acme.com', '$2a$10$YourHashedPasswordHere', 'John', 'Admin', 'owner', '550e8400-e29b-41d4-a716-446655440001', true, true),
('550e8400-e29b-41d4-a716-446655440012', 'owner@techstart.com', '$2a$10$YourHashedPasswordHere', 'Jane', 'Owner', 'owner', '550e8400-e29b-41d4-a716-446655440002', true, true),
('550e8400-e29b-41d4-a716-446655440013', 'user1@acme.com', '$2a$10$YourHashedPasswordHere', 'Alice', 'Smith', 'user', '550e8400-e29b-41d4-a716-446655440001', true, true),
('550e8400-e29b-41d4-a716-446655440014', 'user2@acme.com', '$2a$10$YourHashedPasswordHere', 'Bob', 'Johnson', 'user', '550e8400-e29b-41d4-a716-446655440001', true, true);

-- Insert sample conversations
INSERT INTO conversations (id, user_id, team_id, title, model) VALUES
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440001', 'Q1 Sales Analysis', 'claude-3-sonnet'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440001', 'Market Research Summary', 'claude-3-sonnet');

-- Insert sample messages
INSERT INTO messages (conversation_id, role, content, tokens) VALUES
('650e8400-e29b-41d4-a716-446655440001', 'user', 'Can you analyze our Q1 sales data?', 12),
('650e8400-e29b-41d4-a716-446655440001', 'assistant', 'I''d be happy to help analyze your Q1 sales data. Please upload the sales report and I''ll provide insights on trends, top performers, and areas for improvement.', 35),
('650e8400-e29b-41d4-a716-446655440002', 'user', 'What are the current trends in our industry?', 10),
('650e8400-e29b-41d4-a716-446655440002', 'assistant', 'Based on recent market data, here are the key trends in your industry: 1) Increased automation, 2) Focus on sustainability, 3) Remote work enablement, 4) AI integration.', 42);

-- Insert sample documents
INSERT INTO documents (user_id, team_id, filename, original_filename, file_type, file_size, storage_path, mime_type, status) VALUES
('550e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440001', 'q1_sales_2024.pdf', 'Q1 Sales Report 2024.pdf', 'pdf', 2458240, '/uploads/q1_sales_2024.pdf', 'application/pdf', 'analyzed'),
('550e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440001', 'market_research.xlsx', 'Market Research.xlsx', 'xlsx', 1024000, '/uploads/market_research.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'uploaded');

-- Insert sample activity logs
INSERT INTO activity_logs (user_id, team_id, action, resource_type, resource_id, ip_address) VALUES
('550e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440001', 'document_upload', 'document', '550e8400-e29b-41d4-a716-446655440013', '192.168.1.100'),
('550e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440001', 'conversation_created', 'conversation', '650e8400-e29b-41d4-a716-446655440002', '192.168.1.101');

-- Insert sample usage metrics
INSERT INTO usage_metrics (user_id, team_id, metric_type, metric_value) VALUES
('550e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440001', 'ai_tokens_used', 1500),
('550e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440001', 'documents_analyzed', 3),
('550e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440001', 'conversations_created', 5);
