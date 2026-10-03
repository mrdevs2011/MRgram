-- Add CHECK constraints for profiles
ALTER TABLE "public"."profiles" 
  ADD CONSTRAINT "profiles_bio_length_check" CHECK (char_length(bio) <= 1000);

ALTER TABLE "public"."profiles" 
  ADD CONSTRAINT "profiles_fullname_length_check" CHECK (char_length(full_name) <= 100);

-- Add CHECK constraints for groups
ALTER TABLE "public"."groups" 
  ADD CONSTRAINT "groups_name_length_check" CHECK (char_length(name) <= 100);

ALTER TABLE "public"."groups" 
  ADD CONSTRAINT "groups_description_length_check" CHECK (char_length(description) <= 1000);

-- Stories caption
ALTER TABLE "public"."stories" 
  ADD CONSTRAINT "stories_caption_length_check" CHECK (caption IS NULL OR char_length(caption) <= 500);
