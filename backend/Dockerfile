FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY OceanERP.slnx ./
COPY dotnet-tools.json ./
COPY backend ./backend
RUN dotnet restore OceanERP.slnx
RUN dotnet publish backend/src/Erp.Api/Erp.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
COPY --from=build /app/publish .
RUN mkdir -p /var/lib/oceanerp/documents /var/log/oceanerp
VOLUME ["/var/lib/oceanerp/documents", "/var/log/oceanerp"]
EXPOSE 8080
ENTRYPOINT ["dotnet", "Erp.Api.dll"]

