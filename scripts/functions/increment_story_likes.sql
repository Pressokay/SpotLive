-- Fonction pour incrémenter/décrémenter les likes de manière atomique
CREATE OR REPLACE FUNCTION public.increment_story_likes(
  story_id text,
  increment integer
) RETURNS TABLE(
  id text,
  likes integer
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE stories 
  SET 
    likes = GREATEST(0, COALESCE(likes, 0) + increment)
  WHERE 
    id = story_id
  RETURNING id, likes;
END;
$$;
