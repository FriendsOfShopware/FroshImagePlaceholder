use lambda_http::{run, service_fn, Body, Error, Request, Response, aws_lambda_events::{serde_json::json}, RequestExt};
use std::io::Cursor;
use base64::{engine::general_purpose, Engine as _};

async fn function_handler(_event: Request) -> Result<Response<Body>, Error> {
    let params = _event.query_string_parameters();
    let uri_part = params.first(&"url");
    if uri_part.is_none() {
        return Ok(Response::builder()
            .status(400)
            .header("Content-Type", "application/json")
            .body(
                json!( {
                    "message": "url parameter is required",
                })
                .to_string()
                .into(),
            )
            .expect("failed to render response"));
    }

    let img_url = uri_part.unwrap().trim();

    let response = reqwest::get(img_url).await?;

    if response.status() != 200 {
        return Ok(Response::builder()
            .status(400)
            .header("Content-Type", "application/json")
            .body(
                json!( {
                    "message": "got non 200 response",
                })
                .to_string()
                .into(),
            )
            .expect("failed to render response"));
    }

    let bytes = response.bytes().await?;

    let image_format = match params.first("format") {
        Some("png") => image::ImageFormat::Png,
        Some("jpeg") => image::ImageFormat::Jpeg,
        Some("gif") => image::ImageFormat::Gif,
        Some("webp") => image::ImageFormat::WebP,
        None => image::ImageFormat::Png,
        Some(&_) => image::ImageFormat::Png,
    };

    let img = image::load(Cursor::new(bytes.to_vec()), image_format)?;

    let thumb = img.thumbnail(100, 100);

    let hash = thumbhash::rgba_to_thumb_hash(thumb.width().try_into().unwrap(), thumb.height().try_into().unwrap(), thumb.to_rgba8().as_raw());


    let bytes = hash.iter().map(|&b| b as u8).collect::<Vec<u8>>();
    let encoded = general_purpose::STANDARD.encode(bytes);
    let trimmed = encoded.trim_end_matches('=');

    Ok(Response::builder()
        .header("Content-Type", "application/json")
        .body(
            json!( {
                "data_url": trimmed,
            })
            .to_string()
            .into(),
        )
        .expect("failed to render response"))
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .without_time()
        .init();

    run(service_fn(function_handler)).await
}
