-- Departments created by older versions have no colour, so the frontend showed every one of
-- them with the default (Quality Control) seal. Give the seven standard departments their own
-- seal's colour key when theirs is missing; departments with a colour are left alone.
UPDATE departments d
SET color = v.color
FROM (VALUES
    ('administration', 'avatar-rose'),
    ('development', 'avatar-violet'),
    ('quality control', 'avatar-azure'),
    ('external affairs', 'avatar-jade'),
    ('ethics & regulations', 'avatar-silver'),
    ('human resources', 'avatar-orange'),
    ('engineering & innovation', 'avatar-snow')
) AS v(name, color)
WHERE lower(trim(d.name)) = v.name
  AND (d.color IS NULL OR trim(d.color) = '');
