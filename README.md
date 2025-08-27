# gestorSiscont

PWA de exemplo para o projeto **mobileTeste** usando Supabase.

Os arquivos principais estão em `mobileTeste/` e incluem um dashboard simples para visualizar os dados da tabela `pedidos_local`.

Para criar as tabelas necessárias no Supabase, utilize o script SQL em `mobileTeste/schema.sql`.

## Como executar o dashboard

1. Instale e inicie um servidor HTTP simples, por exemplo com o [http-server](https://www.npmjs.com/package/http-server):

   ```bash
   npx http-server mobileTeste -p 8080
   ```

2. Acesse o endereço [http://localhost:8080](http://localhost:8080) no navegador para ver o dashboard.
