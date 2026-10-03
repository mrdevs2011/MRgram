-- Add CHECK constraints to prevent giant text payloads that could crash clients
ALTER TABLE "public"."messages" 
  ADD CONSTRAINT "messages_text_length_check" CHECK (char_length(text) <= 5000);

ALTER TABLE "public"."group_messages" 
  ADD CONSTRAINT "gmsg_text_length_check" CHECK (char_length(text) <= 5000);

ALTER TABLE "public"."posts" 
  ADD CONSTRAINT "posts_text_length_check" CHECK (char_length(text) <= 10000);

ALTER TABLE "public"."comments" 
  ADD CONSTRAINT "comments_text_length_check" CHECK (char_length(text) <= 3000);
