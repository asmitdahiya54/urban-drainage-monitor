## Deployment and failure behaviour

**How is the system deployed?**

The frontend is deployed on Vercel at https://urban-drainage-monitor.vercel.app/. The browser communicates with the Flask API through the application's API routes. The backend runs under Gunicorn (`backend.wsgi:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120`) as a Render Web Service. The production database uses Supabase PostgreSQL with PostGIS.