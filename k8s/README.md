# Kubernetes local demo

These manifests run the same four services as `docker-compose.yml`:

- `frontend` Node static server
- `backend` FastAPI API
- `mongo` MongoDB with a PVC
- `redis` Redis session/cache

The Kubernetes demo uses HTTP for local port-forwarding. Docker Compose still uses the self-signed HTTPS setup.

## Build local images

For Minikube:

```bash
minikube start
eval $(minikube docker-env)
docker build -t lims-backend:local ./backend
docker build -t lims-frontend:local ./frontend
```

For kind:

```bash
kind create cluster
docker build -t lims-backend:local ./backend
docker build -t lims-frontend:local ./frontend
kind load docker-image lims-backend:local
kind load docker-image lims-frontend:local
```

## Deploy

`secret.example.yaml` contains a demo `JWT_SECRET` for local use. Replace it before using these manifests outside a local demo.

```bash
kubectl apply -f k8s/
kubectl rollout status deployment/mongo
kubectl rollout status deployment/redis
kubectl rollout status deployment/backend
kubectl rollout status deployment/frontend
```

## Open locally

Run these in separate terminals:

```bash
kubectl port-forward svc/backend 3000:3000
kubectl port-forward svc/frontend 8080:8080
```

Then open:

```text
http://localhost:8080/
http://localhost:3000/api/health
```

## Validate manifests

```bash
kubectl apply --dry-run=client -f k8s/
```

## Reset demo data

```bash
kubectl delete -f k8s/
kubectl delete pvc mongo-data
```
