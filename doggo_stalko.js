var fs = require("fs");
var Jimp = require("jimp");
var child_process = require("child_process");


var mailer = require("nodemailer");

var transporter = mailer.createTransport({
	service: "[REDACTED]",
	auth: {
		user: "[REDACTED]",
		pass: "[REDACTED]"
	}
});


function divide(heatmap, dist, val) {
	dist = (dist === undefined) ? 10 : dist;
	val = (val === undefined) ? 128 : val;
	
	var x, y, regions = [], i, iX, iY, ry, color;//, per, percent = -1;
	
	for (x = 0; x <= heatmap.bitmap.width; x += 1) {
		for (y = 0; y <= heatmap.bitmap.height; y += 1) {
			/*per = Math.round(10000 * (x * heatmap.bitmap.height + y) / ((heatmap.bitmap.width + 1) * (heatmap.bitmap.height + 1))) / 100;
			if (Math.round(per) !== percent) {
				percent = Math.round(per);
				
				console.log(percent);
			}*/
			
			color = Jimp.intToRGBA(heatmap.getPixelColor(x, y)).r;
			
			if (color <= val) {
				for (i = 0; i < regions.length; i += 1) {
					for (iX = Math.max(0, x - dist); iX <= Math.min(heatmap.bitmap.width, x + dist); iX += 1) {
						ry = Math.round(Math.sqrt(dist * dist - Math.pow(iX - x, 2)));
						
						for (iY = Math.max(0, y - ry); iY <= Math.min(heatmap.bitmap.height, y - ry); iY += 1) {
							if (regions[i].indexOf(iX + "," + iY) > -1) {							
								iY = heatmap.bitmap.height + 1;
								iX = heatmap.bitmap.width + 1;
								
								regions[i].push(x + "," + y);
								
								i = regions.length + 1;
							}
						}
					}
				}
				
				if (i === regions.length) {
					regions[i] = [x + "," + y];
				}
			}
		}
	}
	
	return regions;
}





var lastPic = undefined, I = 0, recording = false, emails = 0;

function stalko() {
	child_process.exec("CommandCam.exe", function (err, stdout, stderr) {
		if (err) {
			console.log(err);
			
			return;
		}
		
		fs.readFile("./image.bmp", function (err, content) {
			if (err) {
				console.log(err);
				
				return;
			}
			
			// time to put as file name
			var date = new Date(), time = (date.getMonth() + 1) + "." + date.getDate() + "." + date.getFullYear() + " " + date.getHours() + "h" + date.getMinutes() + "m" + date.getSeconds();
			
			fs.writeFile("./DOG Scans/" + time + ".png", content, function (err) {
				if (err) {
					console.log(err);
					
					return;
				}
				
				Jimp.read("./DOG Scans/" + time + ".png", function (err, pic) {
					if (err) {
						console.log(err);
						
						return;
					}
					
					if (lastPic === undefined) {
						lastPic = pic;
						
						stalko();
						
						return;
					}
					
					
					
					var heatmap = new Jimp(pic.bitmap.width, pic.bitmap.height, function (err, heatmap) {
						if (err) {
							console.log(err);
							
							return;
						}
						
						var minD = Infinity, maxD = 0, difs = [], maxX, maxY, difSum = 0;
						
						pic.scan(0, 0, pic.bitmap.width, pic.bitmap.height, function (x, y, idx) {
							var r1, g1, b1, r2, g2, b2, dif;
							
							r1 = pic.bitmap.data[idx];
							g1 = pic.bitmap.data[idx + 1];
							b1 = pic.bitmap.data[idx + 2];
							
							r2 = lastPic.bitmap.data[idx];
							g2 = lastPic.bitmap.data[idx + 1];
							b2 = lastPic.bitmap.data[idx + 2];
							
							dif = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
							
							if (difs[y] === undefined) {
								difs[y] = [];
							}
							difs[y][x] = dif;
							
							difSum += dif;
							
							minD = (dif < minD) ? dif : minD;
							
							if (dif > maxD) {
								maxD = dif;
								
								maxX = x;
								maxY = y;
							}
						});
						
						pic.scan(0, 0, pic.bitmap.width, pic.bitmap.height, function (x, y, idx) {
							var dif = difs[y][x], t = (maxD - dif) / (maxD - minD), color = Math.round(255 * t);
							
							heatmap.bitmap.data[idx] = color;
							heatmap.bitmap.data[idx + 1] = color;
							heatmap.bitmap.data[idx + 2] = color;
							heatmap.bitmap.data[idx + 3] = pic.bitmap.data[idx + 3];
						});
						
						
						heatmap.write("./Heatmaps/" + time + ".png", function () {
							//var region = new Region(heatmap), start;
							
							//start = region.genStart([], [maxX + "," + maxY]);
							
							var regions = divide(heatmap), i, k, x, y, n = 0;
							
							for (i = 0; i < regions.length; i += 1) {
								
								n += regions[i].length;
								
								for (k = 0; k < regions[i].length; k += 1) {
									x = regions[i][k].split(",");
									y = Number(x[1]);
									x = Number(x[0]);
									
									heatmap.setPixelColor(0x0000FFFF, x, y);
								}
							}
							
							n = Math.round(100 * n / regions.length) / 100;
							
							if (regions.length > 100 && n >= 1.15 && recording === false) {
								//recording = 20;
								
								console.log("MOVEMENT DETECTED - n: " + n + " - RECORDING [" + time + "]");
								heatmap.write("./Processed Heatmaps/" + time + " " + n + ".png", function () {
									if (emails > 15) {
										return;
									}
									
									lastPic.write("./lastPicture.png", function () {
										lastPic = pic;
										
										var mailOptions = {
											from: "\"The DOG Scan\" [REDACTED]",
											to: "[REDACTED]",
											subject: "DOG Scan - Movement Detected",
											text: "A picture was taken at " + time + ", in which the n coefficient " + n + " was greater than expected. This could mean there was movement in the picture. Below is the picture taken, which hopefully contains Macken. I will proceed to take 100 pictures and store them locally to later serve as footage.\n\nMore information:\nn: " + n + " average pixels/region\nRegions: " + regions.length + "\nMinimum Difference: " + minD + "\nMaximum difference: " + maxD + "\nAverage difference: " + (Math.round(100 * difSum / (pic.bitmap.width * pic.bitmap.height)) / 100),
											attachments: [
												{
													path: "./DOG Scans/" + time + ".png"
												},
												{
													path: "./Heatmaps/" + time + ".png"
												},
												{
													path: "./Processed Heatmaps/" + time + " " + n + ".png"
												},
												{
													path: "./lastPicture.png"
												}
											]
										};
										
										console.log(mailOptions.text);

										transporter.sendMail(mailOptions, function (err, info) {
											if (err) {
												console.log(err);
												
												return;
											}
											
											console.log("EMAIL SENT");
											console.log(info);
										});
										
										emails += 1;
									});
								});
								
								var times = 0, int;
								
								function takePic() {
									times += 1;
									
									if (times === 100) {
										stalko();
										
										return;
									}

									child_process.exec("CommandCam.exe", function (err, stdout, stderr) {
										if (err) {
											console.log(err);
											
											return;
										}
										
										fs.readFile("./image.bmp", function (err, content) {
											if (err) {
												console.log(err);
												
												return;
											}
											
											var date = new Date(), time = (date.getMonth() + 1) + "." + date.getDate() + "." + date.getFullYear() + " " + date.getHours() + "h" + date.getMinutes() + "m" + date.getSeconds();
											
											fs.writeFile("./Footage/" + time + ".png", content, function (err) {
												if (err) {
													console.log(err);
													
													return;
												}
												
												takePic();
											});
										});
									});
								}
								
								takePic();
							} else if (recording === false) {
								lastPic = pic;
								
								fs.unlink("./DOG Scans/" + time + ".png", function (err) {
									if (err) {
										console.log(err);
										
										return;
									}
									
									fs.unlink("./Heatmaps/" + time + ".png", function (err) {
										if (err) {
											console.log(err);
											
											return;
										}
										
										console.log("n: " + n + " [" + time + "]");
										
										stalko();
									});
								});
							} else if (recording < 11) {
								lastPic = pic;
								
								recording += 1;
								
								console.log("NEW PICTURE - n: " + n + " [" + time + "]");
								
								heatmap.write("./Processed Heatmaps/" + time + " " + n + ".png", function () {
									stalko();
								});
							} else if (recording === 11) {
								lastPic = pic;
								
								console.log("RECORDING TERMINATED [" + time + "]");
								
								recording = false;
								
								stalko();
							}
						});
					});
				});
			});
		});
	});
}

stalko();