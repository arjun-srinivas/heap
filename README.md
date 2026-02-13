# Heap Snapshot Constructor View

A small HTML/CSS/JS tool that reads a Chrome/V8 `.heapsnapshot` file and renders a constructor summary table (constructor, instance count, and shallow size), inspired by the DevTools Constructor view.

## Run

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173` and upload a heap snapshot.
