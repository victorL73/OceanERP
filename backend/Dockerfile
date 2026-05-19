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
COPY deploy/ubuntu /opt/oceanerp/deploy/ubuntu
RUN apt-get update \
    && (apt-get install -y --no-install-recommends bash ca-certificates postgresql-client-16 tar gzip \
      || apt-get install -y --no-install-recommends bash ca-certificates postgresql-client tar gzip) \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/lib/oceanerp/documents /var/log/oceanerp /opt/oceanerp/backups \
    && chmod +x /opt/oceanerp/deploy/ubuntu/*.sh
VOLUME ["/var/lib/oceanerp/documents", "/var/log/oceanerp"]
EXPOSE 8080
ENTRYPOINT ["dotnet", "Erp.Api.dll"]
