/*global TextDecoderStream, TransformStream*/
import JsonBigint from "json-bigint";

const REQUEST_TIMEOUT_SEC = 60000

export async function* callDalleService(backendUrl, text, numImages) {
    const queryStartTime = new Date()
    const stream = await Promise.race([
        (await fetch(backendUrl + `/dalle`, {
                method: 'POST',
                headers: {
                    'Bypass-Tunnel-Reminder': "go",
                    'mode': 'no-cors'
                },
                body: JSON.stringify({
                    text,
                    'num_images': numImages,
                })
            }
        ).then((response) => {
            if (!response.ok) {
                throw Error(response.statusText);
            }
	  let textBuffer = '';

	  return response.body
	    // Decode as UTF-8 Text
	    .pipeThrough(new TextDecoderStream())

	    // Split on lines
	    .pipeThrough(new TransformStream({
	      transform(chunk, controller) {
		textBuffer += chunk;
		const lines = textBuffer.split('\n');
		for (const line of lines.slice(0, -1)) {
		  controller.enqueue(line);
		}
		textBuffer = lines.slice(-1)[0];
	      },
	      flush(controller) {
		if (textBuffer) {
		  controller.enqueue(textBuffer);
		}
	      }
	    }))

	    // Parse JSON objects
	    .pipeThrough(new TransformStream({
	      transform(line, controller) {
		if (line) {
		  controller.enqueue(
		    JsonBigint.parse(line)
		  );
		}
	      }
	    })).getReader();
        })), new Promise((_, reject) => setTimeout(
            () => reject(new Error('Timeout')), REQUEST_TIMEOUT_SEC))
    ]);
    let result;
    while (!result || !result.done) {
        result = await stream.read();
        if (result.done) return;
	yield result.value;
    }
}

export async function checkIfValidBackend(backendUrl) {
    return await fetch(backendUrl, {
        headers: {
            'Bypass-Tunnel-Reminder': "go",
            'mode': 'no-cors'
        }
    }).then(function (response) {
        return true
    }).catch(() => {
        return false
    })
}
