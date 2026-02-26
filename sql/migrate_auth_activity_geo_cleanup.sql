-- Cleanup previously URL-encoded geo headers in auth_activity

CREATE OR REPLACE FUNCTION public.url_decode_utf8(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  i integer := 1;
  len integer := length(input);
  ch text;
  hex text;
  out_bytes bytea := ''::bytea;
BEGIN
  WHILE i <= len LOOP
    ch := substr(input, i, 1);

    IF ch = '%' AND i + 2 <= len THEN
      hex := substr(input, i + 1, 2);

      IF hex ~ '^[0-9A-Fa-f]{2}$' THEN
        out_bytes := out_bytes || decode(hex, 'hex');
        i := i + 3;
        CONTINUE;
      END IF;
    ELSIF ch = '+' THEN
      out_bytes := out_bytes || decode('20', 'hex');
      i := i + 1;
      CONTINUE;
    END IF;

    out_bytes := out_bytes || convert_to(ch, 'UTF8');
    i := i + 1;
  END LOOP;

  RETURN convert_from(out_bytes, 'UTF8');
END;
$$;

UPDATE auth_activity
SET
  city = public.url_decode_utf8(city),
  country = public.url_decode_utf8(country)
WHERE
  (city IS NOT NULL AND (strpos(city, '%') > 0 OR strpos(city, '+') > 0))
  OR (country IS NOT NULL AND (strpos(country, '%') > 0 OR strpos(country, '+') > 0));

DROP FUNCTION public.url_decode_utf8(text);
