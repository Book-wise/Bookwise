# Desarrollo Local

## Scripts declarados

`package.json` declara:

- `npm start`: ejecuta `ng serve`.
- `npm run build`: ejecuta `ng build`.
- `npm run watch`: ejecuta `ng build --watch --configuration development`.
- `npm test`: ejecuta `ng test`.

## API local

`src/environments/environment.ts` configura:

```ts
apiUrl: 'http://127.0.0.1:9999/api/v1'
```

El README existente tambien indica que requiere la API Laravel corriendo en `http://127.0.0.1:9999`.

## No ejecutado en este levantamiento

No se ejecutaron:

- `npm install`
- `npm start`
- `npm run build`
- `npm test`
- servidores locales

Por lo tanto, esta documentacion no confirma que el proyecto compile o que los tests pasen en el entorno actual.

