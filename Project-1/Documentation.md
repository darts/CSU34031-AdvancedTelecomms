# CSU34031 Advanced Telecommunications

## Project-1 - Senán d'Art - 17329580

### High-Level Overview

For every connection to the proxy server (multiple occurences possible for each user):  

- If the requested **URL is not blacklisted**:
  - If the connection **uses TLS or is a Websocket**:
    - Pipe all packets from server to client
    - Pipe all packets from client to server
    - Notes:
      - There is no reason to parse this data further
  - Else the connection **does not use TLS and is not a websocket**:
    - If the **packet is cached already**:
      - If the **cached item is not expired**:
        - Update the age of the packet and send it as response to the client
      - Else the **cached item is expired**:
        - Remove from cache and continue as if it was never cached
    - Else **packet is not cached**:
      - Send request to server
      - On server response:
        - If the **response packet is cache-able** (based on header params):
          - If **response is chunked**:
            - Send each chunk to the user as it arrives
            - Temporarily store each chunk
            - When transmission is complete -> add all chunked data to cache
          - Else **response is not chunked**
            - Send response packet to client
            - Add packet to cache
        - Else the **response packet is not cache-able**:
          - Pipe the response to the user
- Else the requested **URL is blacklisted**:
  - Send a `403 FORBIDDEN` response to the client
  - Close the connection
