#![type_length_limit = "1195029"]

use std::time::Duration;

use lambda_runtime::lambda;
use log::{error,
          info};
use node_identifier::{init_dynamodb_client,
                      local_handler,
                      retry_handler};
use rusoto_core::RusotoError;
use rusoto_dynamodb::DynamoDb;
use tokio::runtime::Runtime;

// fn main() {
//     simple_logger::init_with_level(log::Level::Info).unwrap();
//     lambda!(retry_handler);
// }

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let env = grapl_config::init_grapl_env!();

    if env.is_local {
        info!("Running locally");
        let mut runtime = Runtime::new().unwrap();

        let dynamodb_client = init_dynamodb_client();
        loop {
            if let Err(e) = runtime.block_on(dynamodb_client.describe_endpoints()) {
                match e {
                    RusotoError::HttpDispatch(_) => {
                        info!("Waiting for DynamoDB to become available");
                        std::thread::sleep(Duration::new(2, 0));
                    }
                    _ => break,
                }
            }
        }
        // An extra sleep, for good measure
        std::thread::sleep(Duration::new(2, 0));

        loop {
            if let Err(e) = runtime.block_on(async move { local_handler(false).await }) {
                error!("{}", e);
            }

            std::thread::sleep(Duration::new(2, 0));
        }
    } else {
        info!("Running in AWS");
        lambda!(retry_handler);
    }
    Ok(())
}
