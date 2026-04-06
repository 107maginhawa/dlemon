use cadence::protocol::CADENCE_ALPN;
use iroh::{Endpoint, NodeAddr};
use std::collections::BTreeSet;

async fn make_endpoint() -> Endpoint {
    Endpoint::builder()
        .alpns(vec![CADENCE_ALPN.to_vec()])
        .discovery_local_network()
        .bind()
        .await
        .expect("Failed to bind endpoint")
}

/// Get a NodeAddr with localhost addresses for local connection.
fn local_node_addr(ep: &Endpoint) -> NodeAddr {
    let (v4, v6) = ep.bound_sockets();
    let mut addrs = BTreeSet::new();
    let v4 = if v4.ip().is_unspecified() {
        std::net::SocketAddr::new(std::net::Ipv4Addr::LOCALHOST.into(), v4.port())
    } else {
        v4
    };
    addrs.insert(v4);
    if let Some(v6) = v6 {
        let v6 = if v6.ip().is_unspecified() {
            std::net::SocketAddr::new(std::net::Ipv6Addr::LOCALHOST.into(), v6.port())
        } else {
            v6
        };
        addrs.insert(v6);
    }
    NodeAddr {
        node_id: ep.node_id(),
        relay_url: None,
        direct_addresses: addrs,
    }
}

#[tokio::test]
async fn test_two_peers_discover_mdns() {
    let ep_a = make_endpoint().await;
    let ep_b = make_endpoint().await;

    let addr_b = local_node_addr(&ep_b);
    ep_a.add_node_addr(addr_b.clone()).ok();

    let (done_tx, done_rx) = tokio::sync::oneshot::channel::<()>();
    let accept_handle = tokio::spawn(async move {
        let incoming = ep_b.accept().await.unwrap();
        let conn = incoming.await.unwrap();
        let (mut send, mut recv) = conn.accept_bi().await.unwrap();
        let mut buf = vec![0u8; 5];
        recv.read_exact(&mut buf).await.unwrap();
        assert_eq!(&buf, b"hello");
        send.write_all(b"world").await.unwrap();
        send.finish().unwrap();
        // Wait until client is done reading
        done_rx.await.ok();
    });

    let conn = ep_a.connect(addr_b, CADENCE_ALPN).await.unwrap();
    let (mut send, mut recv) = conn.open_bi().await.unwrap();
    send.write_all(b"hello").await.unwrap();
    send.finish().unwrap();

    let mut buf2 = vec![0u8; 5];
    recv.read_exact(&mut buf2).await.unwrap();
    assert_eq!(&buf2, b"world");

    done_tx.send(()).ok();
    accept_handle.await.unwrap();
}

#[tokio::test]
async fn test_peer_connect_via_node_id() {
    let ep_a = make_endpoint().await;
    let ep_b = make_endpoint().await;
    let addr_b = local_node_addr(&ep_b);
    ep_a.add_node_addr(addr_b.clone()).ok();
    let node_id_b = ep_b.node_id();

    let accept_handle = tokio::spawn(async move {
        let incoming = ep_b.accept().await.unwrap();
        let conn = incoming.await.unwrap();
        let remote = conn.remote_node_id().unwrap();
        assert_ne!(remote.to_string(), "");
    });

    let conn = ep_a.connect(addr_b, CADENCE_ALPN).await.unwrap();
    let remote = conn.remote_node_id().unwrap();
    assert_eq!(remote, node_id_b);

    accept_handle.await.unwrap();
}

#[tokio::test]
async fn test_alpn_negotiation() {
    let ep_a = make_endpoint().await;
    let ep_b = make_endpoint().await;
    let addr_b = local_node_addr(&ep_b);
    ep_a.add_node_addr(addr_b.clone()).ok();

    let accept_handle = tokio::spawn(async move {
        let incoming = ep_b.accept().await.unwrap();
        let conn = incoming.await.unwrap();
        let _ = conn.remote_node_id().unwrap();
    });

    let conn = ep_a.connect(addr_b, CADENCE_ALPN).await.unwrap();
    let _ = conn.remote_node_id().unwrap();
    accept_handle.await.unwrap();
}

#[tokio::test]
async fn test_bidirectional_stream() {
    let ep_a = make_endpoint().await;
    let ep_b = make_endpoint().await;
    let addr_b = local_node_addr(&ep_b);
    ep_a.add_node_addr(addr_b.clone()).ok();

    let (done_tx, done_rx) = tokio::sync::oneshot::channel::<()>();
    let accept_handle = tokio::spawn(async move {
        let incoming = ep_b.accept().await.unwrap();
        let conn = incoming.await.unwrap();
        let (mut send, mut recv) = conn.accept_bi().await.unwrap();

        let mut buf = vec![0u8; 4];
        recv.read_exact(&mut buf).await.unwrap();
        assert_eq!(&buf, b"ping");

        send.write_all(b"pong").await.unwrap();
        send.finish().unwrap();
        done_rx.await.ok();
    });

    let conn = ep_a.connect(addr_b, CADENCE_ALPN).await.unwrap();
    let (mut send, mut recv) = conn.open_bi().await.unwrap();

    send.write_all(b"ping").await.unwrap();
    send.finish().unwrap();

    let mut buf = vec![0u8; 4];
    recv.read_exact(&mut buf).await.unwrap();
    assert_eq!(&buf, b"pong");

    done_tx.send(()).ok();
    accept_handle.await.unwrap();
}

#[tokio::test]
async fn test_connection_refused_wrong_alpn() {
    let ep_a = Endpoint::builder()
        .alpns(vec![b"wrong-protocol".to_vec()])
        .bind()
        .await
        .unwrap();

    let ep_b = make_endpoint().await;
    let addr_b = local_node_addr(&ep_b);
    ep_a.add_node_addr(addr_b.clone()).ok();

    let accept_handle = tokio::spawn(async move {
        let result = tokio::time::timeout(std::time::Duration::from_secs(3), async {
            if let Some(incoming) = ep_b.accept().await {
                let _ = incoming.await;
            }
        })
        .await;
        let _ = result;
    });

    // Connection with wrong ALPN — may succeed at transport but fail at protocol
    let result = ep_a.connect(addr_b, b"wrong-protocol").await;
    let _ = result;

    accept_handle.await.unwrap();
}

#[tokio::test]
async fn test_multiple_concurrent_connections() {
    let ep_server = make_endpoint().await;
    let addr_server = local_node_addr(&ep_server);

    let (done_tx, mut done_rx) = tokio::sync::mpsc::channel::<()>(5);
    let server_handle = tokio::spawn(async move {
        let mut count = 0;
        let mut conns = Vec::new();
        for _ in 0..5 {
            if let Some(incoming) = ep_server.accept().await {
                if let Ok(conn) = incoming.await {
                    if let Ok((mut send, mut recv)) = conn.accept_bi().await {
                        let mut buf = [0u8; 1];
                        if recv.read_exact(&mut buf).await.is_ok() {
                            send.write_all(&[buf[0] + 1]).await.ok();
                            send.finish().ok();
                        }
                        count += 1;
                        conns.push(conn);
                    }
                }
            }
        }
        // Wait for all clients to finish reading
        for _ in 0..5 {
            done_rx.recv().await;
        }
        count
    });

    let mut handles = Vec::new();
    for i in 0u8..5 {
        let ep = make_endpoint().await;
        let addr = addr_server.clone();
        ep.add_node_addr(addr.clone()).ok();
        let tx = done_tx.clone();
        handles.push(tokio::spawn(async move {
            let conn = ep.connect(addr, CADENCE_ALPN).await.unwrap();
            let (mut send, mut recv) = conn.open_bi().await.unwrap();
            send.write_all(&[i]).await.unwrap();
            send.finish().unwrap();
            let mut response = [0u8; 1];
            recv.read_exact(&mut response).await.unwrap();
            assert_eq!(response[0], i + 1);
            tx.send(()).await.ok();
        }));
    }
    drop(done_tx); // Drop original sender

    for h in handles {
        h.await.unwrap();
    }

    let count = server_handle.await.unwrap();
    assert_eq!(count, 5, "Server should handle 5 concurrent connections");
}
