# Disabled Features

## Blog

Status: temporarily removed from the active app to keep the first server deployment small.

Removed active entry points:

- `backend/app/api/blog`
- `backend/app/modules/blog`
- `backend/app/content/blog`
- `backend/app/tools/create_blog_post.py`
- `backend/app/tools/import_hexo_blog.py`
- `frontend/src/features/blog`

Disabled references:

- `backend/app/app.py`: blog OpenAPI tag and startup warmup
- `backend/app/api/router.py`: `/api/v1/blog`
- `frontend/src/app/routes.ts`: `/blog` routes
- `frontend/src/app/constants.tsx`: blog nav and overview card
- `frontend/src/api/client.ts`: blog API calls
- `frontend/src/api/types.ts`: blog API types

Restore path:

1. Revert the commit that removed the blog files, or recover the paths above from git history.
2. Restore the route imports and nav entries listed above.
3. Rebuild the backend and frontend images.
