@echo off
setlocal

:: Solicita a mensagem do commit
set /p commitMsg=Digite a mensagem do commit: 

:: Exibe o status atual do Git
echo ------------------------------
echo Verificando status do Git...
git status
echo ------------------------------

:: Adiciona todas as alterações
echo Adicionando arquivos modificados...
git add .

:: Realiza o commit com a mensagem informada
echo Realizando commit...
git commit -m "%commitMsg%"

:: Garante que está na branch main
echo Garantindo branch main...
git branch -M main

:: Envia para o repositório remoto
echo Enviando para o GitHub...
git push origin main

:: Fim
echo ------------------------------
echo Push realizado com sucesso!
pause
endlocal
